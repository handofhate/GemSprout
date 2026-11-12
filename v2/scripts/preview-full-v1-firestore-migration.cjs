const fs = require('node:fs');
const path = require('node:path');
const { migrateV1FamilySnapshot } = require('../dist/src/migration');

const argv = process.argv.slice(2);
const positional = [];
const excludedFamilyIds = new Set();
for (let index = 0; index < argv.length; index += 1) {
  if (argv[index] === '--exclude-family') {
    const familyId = argv[index + 1];
    if (!familyId) throw new Error('--exclude-family requires a family code.');
    excludedFamilyIds.add(familyId.trim().toUpperCase());
    index += 1;
  } else {
    positional.push(argv[index]);
  }
}
const [inputArg = 'all-families-firestore-restore-raw.json', outputArg = 'all-families-v2-migration-preview.json'] = positional;
const inputPath = path.resolve(process.cwd(), inputArg);
const outputPath = path.resolve(process.cwd(), outputArg);

function decodeValue(value) {
  if (!value || typeof value !== 'object') return value;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('timestampValue' in value) return value.timestampValue;
  if ('referenceValue' in value) return value.referenceValue;
  if ('bytesValue' in value) return value.bytesValue;
  if ('geoPointValue' in value) return value.geoPointValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in value) return decodeFields(value.mapValue.fields);
  return value;
}

function decodeFields(fields) {
  return Object.fromEntries(Object.entries(fields || {}).map(([key, value]) => [key, decodeValue(value)]));
}

function documentId(document) {
  return String(document.name || '').split('/').pop() || '';
}

function memberAuthRecords(member) {
  const providerEmails = new Map();
  for (const provider of Array.isArray(member.authProviders) ? member.authProviders : []) {
    const uid = String(provider?.uid || '');
    const email = String(provider?.email || '').trim().toLowerCase();
    if (!uid || !email) continue;
    const emails = providerEmails.get(uid) || new Set();
    emails.add(email);
    providerEmails.set(uid, emails);
  }
  const allEmails = [...new Set([...providerEmails.values()].flatMap(emails => [...emails]))];
  const uids = new Set([
    member.authUid,
    ...(Array.isArray(member.authUids) ? member.authUids : []),
    ...(Array.isArray(member.authProviders) ? member.authProviders.map(provider => provider?.uid) : []),
  ].filter(value => typeof value === 'string' && value.length > 0));
  return [...uids].map(uid => ({
    uid,
    emails: [...(providerEmails.get(uid) || (allEmails.length === 1 ? new Set(allEmails) : new Set()))],
  }));
}

function countPaths(writes) {
  const counts = {};
  for (const write of writes) counts[write.path] = (counts[write.path] || 0) + 1;
  return Object.entries(counts).filter(([, count]) => count > 1).map(([documentPath, count]) => ({ documentPath, count }));
}

function summarizeWrites(writes) {
  return {
    families: writes.filter(item => /^families\/[^/]+$/.test(item.path)).length,
    members: writes.filter(item => item.path.includes('/members/')).length,
    chores: writes.filter(item => item.path.includes('/chores/')).length,
    completions: writes.filter(item => item.path.includes('/completions/')).length,
    prizes: writes.filter(item => item.path.includes('/prizes/')).length,
    requests: writes.filter(item => item.path.includes('/requests/')).length,
    history: writes.filter(item => item.path.includes('/history/')).length,
    users: writes.filter(item => item.path.startsWith('users/')).length,
  };
}

function main() {
  const source = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  if (!Array.isArray(source.families)) throw new Error('Input is missing the exported families array.');
  const includedFamilies = source.families.filter(family => !excludedFamilyIds.has(String(family.id || documentId(family.root)).toUpperCase()));
  const excludedFamilies = source.families
    .filter(family => excludedFamilyIds.has(String(family.id || documentId(family.root)).toUpperCase()))
    .map(family => {
      const snapshot = decodeFields(family.root?.fields);
      return { familyId: family.id || documentId(family.root), name: snapshot.family?.name || null };
    });
  const unmatchedExclusions = [...excludedFamilyIds].filter(id => !excludedFamilies.some(family => String(family.familyId).toUpperCase() === id));
  if (unmatchedExclusions.length) throw new Error(`Excluded family codes not present in export: ${unmatchedExclusions.join(', ')}`);

  const migratedAt = Date.now();
  const allWrites = [];
  const familyReports = [];
  const warnings = [];
  const familyIds = new Set(includedFamilies.map(family => String(family.id || documentId(family.root)).toUpperCase()));
  const familyCodes = new Set();
  const linkedAuth = new Map();

  for (const exportedFamily of includedFamilies) {
    const snapshot = decodeFields(exportedFamily.root?.fields);
    const subcollectionHistory = (exportedFamily.history || []).map(document => {
      const entry = decodeFields(document.fields);
      if (!entry.id) entry.id = documentId(document);
      return entry;
    });
    const history = subcollectionHistory.length > 0 ? subcollectionHistory : (snapshot.history || []);
    const familySnapshot = { ...snapshot, history };
    const familyId = exportedFamily.id || documentId(exportedFamily.root);
    const result = migrateV1FamilySnapshot(familySnapshot, { familyId, familyCode: familyId, migratedAt });
    familyCodes.add(familyId.toUpperCase());
    for (const member of snapshot.family?.members || []) {
      for (const { uid, emails } of memberAuthRecords(member)) {
        const links = linkedAuth.get(uid) || [];
        links.push({ familyCode: familyId.toUpperCase(), memberId: String(member.id || ''), emails });
        linkedAuth.set(uid, links);
      }
    }
    // V1 already owns the users collection. Rewriting it from member metadata
    // could override V1's UID-first, email-fallback family resolution.
    allWrites.push(...result.writes.filter(item => !item.path.startsWith('users/')));
    warnings.push(...result.warnings.map(message => `${familyId}: ${message}`));
    familyReports.push({
      familyId,
      source: {
        members: snapshot.family?.members?.length || 0,
        chores: snapshot.chores?.length || 0,
        prizes: snapshot.prizes?.length || 0,
        prizeRequests: snapshot.prizeRequests?.length || 0,
        savingsRequests: snapshot.savingsRequests?.length || 0,
        embeddedHistory: snapshot.history?.length || 0,
        historySubcollection: subcollectionHistory.length,
        historyUsed: history.length,
      },
      migration: { ...result.summary, users: 0 },
      warningCount: result.warnings.length,
    });
  }

  const userDocuments = (source.users || []).map(document => ({ id: documentId(document), ...decodeFields(document.fields) }));
  const duplicatePaths = countPaths(allWrites);
  const usersById = new Map(userDocuments.map(user => [user.id, user]));
  const usersByEmail = new Map();
  for (const user of [...userDocuments].sort((left, right) => left.id.localeCompare(right.id))) {
    const email = String(user.email || '').trim().toLowerCase();
    if (!email) continue;
    const matches = usersByEmail.get(email) || [];
    matches.push(user);
    usersByEmail.set(email, matches);
  }
  const v1AuthResolution = [...linkedAuth.entries()].map(([uid, links]) => {
    const direct = usersById.get(uid);
    const linkedFamilyCodes = [...new Set(links.map(link => link.familyCode))];
    const emails = [...new Set(links.flatMap(link => link.emails))];
    const emailFallbacks = emails
      .map(email => ({ email, user: usersByEmail.get(email)?.[0] || null }))
      .filter(item => item.user?.familyCode);
    const resolvedFamilyCodes = direct?.familyCode
      ? [String(direct.familyCode).toUpperCase()]
      : [...new Set(emailFallbacks.map(item => String(item.user.familyCode).toUpperCase()))];
    const resolutionSource = direct?.familyCode ? 'uid-document' : resolvedFamilyCodes.length ? 'email-fallback' : 'none';
    const resolvedFamilyMissingFromExport = resolvedFamilyCodes.filter(code => !familyCodes.has(code));
    return {
      uid,
      linkedFamilyCodes,
      resolutionSource,
      resolvedFamilyCodes,
      emailFallbackDocuments: direct?.familyCode ? [] : emailFallbacks.map(item => ({ email: item.email, userId: item.user.id, familyCode: item.user.familyCode })),
      resolutionMatchesMemberLink: resolvedFamilyCodes.length === 1 && linkedFamilyCodes.includes(resolvedFamilyCodes[0]),
      unresolvedByV1: resolvedFamilyCodes.length === 0,
      ambiguousEmailFallback: !direct?.familyCode && resolvedFamilyCodes.length > 1,
      resolvedFamilyMissingFromExport,
    };
  });
  const userLinkConflicts = v1AuthResolution.filter(item =>
    item.ambiguousEmailFallback || item.resolvedFamilyMissingFromExport.length > 0 ||
    (item.resolvedFamilyCodes.length > 0 && !item.resolutionMatchesMemberLink));
  const userRoleCounts = userDocuments.reduce((counts, user) => {
    const role = user.role || '(missing)';
    counts[role] = (counts[role] || 0) + 1;
    return counts;
  }, {});
  const report = {
    source: {
      project: source.source?.project || null,
      database: source.source?.database || null,
      rootCollections: source.rootCollectionIds || [],
      sourceFamilyCount: source.families.length,
      familyCount: includedFamilies.length,
      excludedFamilies,
      historySubcollectionDocuments: includedFamilies.reduce((sum, family) => sum + (family.history || []).length, 0),
      existingUserDocuments: userDocuments.length,
    },
    migration: {
      ...summarizeWrites(allWrites),
      writes: allWrites.length,
      excludedFamilies,
      byFamily: familyReports,
      duplicateDocumentPaths: duplicatePaths,
      warningCount: warnings.length,
      warnings,
      reviewFlags: {
        conflictingUserPaths: userLinkConflicts.length,
        authUidsUnresolvedByV1: v1AuthResolution.filter(item => item.unresolvedByV1).length,
        authUidsWithAmbiguousV1EmailFallback: v1AuthResolution.filter(item => item.ambiguousEmailFallback).length,
        authUidsWhoseV1FamilyDiffersFromMemberLinks: v1AuthResolution.filter(item => item.resolvedFamilyCodes.length > 0 && !item.resolutionMatchesMemberLink).length,
        existingUserDocsWithUnknownFamilyCode: userDocuments.filter(user => user.familyCode && !familyIds.has(String(user.familyCode).toUpperCase())).length,
        existingUserDocsMissingFamilyCode: userDocuments.filter(user => !user.familyCode).length,
      },
    },
    existingUserLinks: {
      policy: 'Preserve V1 users documents unchanged; resolve auth UID first, then exact email fallback, matching app.js.',
      userDocumentsWithKnownFamilyCode: userDocuments.filter(user => familyCodes.has(String(user.familyCode || '').toUpperCase())).length,
      userDocumentsWithUnknownFamilyCode: userDocuments.filter(user => user.familyCode && !familyCodes.has(String(user.familyCode).toUpperCase())).length,
      userDocumentsMissingFamilyCode: userDocuments.filter(user => !user.familyCode).length,
      uniqueAuthUidsReferencedByFamilyMembers: linkedAuth.size,
      authUidsResolvedByV1: v1AuthResolution.filter(item => !item.unresolvedByV1).length,
      authUidsUnresolvedByV1: v1AuthResolution.filter(item => item.unresolvedByV1).length,
      authResolutionAudit: v1AuthResolution,
      existingUserRoleCounts: userRoleCounts,
      userLinkConflicts,
    },
    writes: allWrites,
  };

  fs.writeFileSync(outputPath, JSON.stringify(report));
  console.log(JSON.stringify({
    input: inputPath,
    output: outputPath,
    source: report.source,
    migration: {
      writes: report.migration.writes,
      families: report.migration.families,
      members: report.migration.members,
      chores: report.migration.chores,
      completions: report.migration.completions,
      prizes: report.migration.prizes,
      requests: report.migration.requests,
      history: report.migration.history,
      users: report.migration.users,
      warningCount: report.migration.warningCount,
      duplicateDocumentPathCount: duplicatePaths.length,
      reviewFlags: report.migration.reviewFlags,
    },
    existingUserLinks: report.existingUserLinks,
    families: familyReports,
  }, null, 2));
}

main();
