import * as vscode from 'vscode';
import { parseCodeowners, findDuplicatedPatterns, findInvalidOwners, findShadowedPatterns, matchesPattern, Violation } from './codeowners';

let diagnostics: vscode.DiagnosticCollection;

function basename(uri: vscode.Uri): string {
  const path = uri.path;
  return path.slice(path.lastIndexOf('/') + 1);
}

function isCodeownersFile(document: vscode.TextDocument): boolean {
  if (basename(document.uri) !== 'CODEOWNERS') return false;
  return true; // any file literally named CODEOWNERS, wherever it lives -- matches GitHub's own 3 accepted locations without hardcoding workspace-relative paths
}

const MAX_FILES_FOR_COVERAGE_CHECK = 5000; // avoids a pathological O(patterns x files) cost on huge repos

async function findUnmatchedPatternsAndUncoveredFiles(
  entries: ReturnType<typeof parseCodeowners>,
): Promise<{ unmatchedPatterns: Violation[]; filesWithoutOwner: Violation[] }> {
  const allFiles = await vscode.workspace.findFiles('**/*', '**/node_modules/**', MAX_FILES_FOR_COVERAGE_CHECK + 1);
  if (allFiles.length > MAX_FILES_FOR_COVERAGE_CHECK) {
    // Too large to check exhaustively in v0.1 -- report neither check
    // rather than a slow or misleading partial scan.
    return { unmatchedPatterns: [], filesWithoutOwner: [] };
  }

  const root = vscode.workspace.workspaceFolders?.[0]?.uri;
  const relativePaths = allFiles.map((uri) => (root ? vscode.workspace.asRelativePath(uri, false) : uri.path));

  const unmatchedPatterns: Violation[] = [];
  for (const entry of entries) {
    const matchesAny = relativePaths.some((path) => matchesPattern(entry.pattern, path));
    if (!matchesAny) {
      unmatchedPatterns.push({
        kind: 'UNMATCHED_PATTERN',
        line: entry.line,
        message: `Pattern "${entry.pattern}" doesn't match any file currently in the workspace -- possibly a typo or a path that moved.`,
      });
    }
  }

  // A file's real owner is whichever pattern matches it LAST in the
  // file (CODEOWNERS semantics) -- a file is "without owner" only
  // when either no pattern matches it at all, or the last matching
  // pattern has zero owners (an explicit un-assignment).
  const filesWithoutOwner: Violation[] = [];
  let uncoveredCount = 0;
  for (const path of relativePaths) {
    let lastMatch: (typeof entries)[number] | undefined;
    for (const entry of entries) {
      if (matchesPattern(entry.pattern, path)) lastMatch = entry;
    }
    if (!lastMatch || lastMatch.owners.length === 0) uncoveredCount++;
  }
  if (uncoveredCount > 0) {
    filesWithoutOwner.push({
      kind: 'FILE_WITHOUT_OWNER',
      line: 1,
      message: `${uncoveredCount} file(s) in the workspace have no CODEOWNERS entry covering them (no matching pattern, or the last matching pattern has no owners).`,
    });
  }

  return { unmatchedPatterns, filesWithoutOwner };
}

async function refresh(document: vscode.TextDocument): Promise<void> {
  if (!isCodeownersFile(document)) {
    diagnostics.delete(document.uri);
    return;
  }

  const entries = parseCodeowners(document.getText());
  const violations: Violation[] = [
    ...findDuplicatedPatterns(entries),
    ...findInvalidOwners(entries),
    ...findShadowedPatterns(entries),
  ];

  const coverage = await findUnmatchedPatternsAndUncoveredFiles(entries);
  violations.push(...coverage.unmatchedPatterns, ...coverage.filesWithoutOwner);

  const result = violations.map((violation) => {
    const line = violation.line - 1;
    const range = new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER);
    const severity =
      violation.kind === 'INVALID_OWNER' || violation.kind === 'PATTERN_SHADOWED'
        ? vscode.DiagnosticSeverity.Warning
        : vscode.DiagnosticSeverity.Information;
    const diagnostic = new vscode.Diagnostic(range, violation.message, severity);
    diagnostic.source = 'CODEOWNERS Validator Companion';
    diagnostic.code = violation.kind;
    return diagnostic;
  });
  diagnostics.set(document.uri, result);
}

export function activate(context: vscode.ExtensionContext): void {
  diagnostics = vscode.languages.createDiagnosticCollection('codeownersValidatorCompanion');
  context.subscriptions.push(diagnostics);

  vscode.workspace.textDocuments.forEach((doc) => void refresh(doc));

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => void refresh(doc)),
    vscode.workspace.onDidSaveTextDocument((doc) => void refresh(doc)),
    vscode.workspace.onDidCloseTextDocument((document) => diagnostics.delete(document.uri)),
  );
}

export function deactivate(): void {
  diagnostics?.dispose();
}
