## Key Points for Future InkPad Development

### 🎯 Critical Monaco Editor Gotchas

#### 1. **React StrictMode Double-Mounting**
- **Problem**: StrictMode causes components to mount twice, creating duplicate Monaco instances
- **Solution**: Use `initializingRef` flag + 10ms delay in cleanup to prevent double creation
- **Location**: [`monaco-editor.tsx`](client/src/components/editor/monaco-editor.tsx:29)
```typescript
// Prevent double creation
initializingRef.current = true;
// In cleanup:
setTimeout(() => { initializingRef.current = false; }, 10);
```

#### 2. **DOM Cleanup for Monaco**
- **Problem**: Monaco leaves DOM artifacts that cause "Element already has context attribute" errors
- **Solution**: Clear container innerHTML in cleanup
- **Location**: [`monaco-editor.tsx`](client/src/components/editor/monaco-editor.tsx:112)
```typescript
if (containerRef.current) {
  containerRef.current.innerHTML = '';
}
```

### ⌨️ Keyboard Event Handling

#### 3. **Event Propagation Control**
- **Problem**: Parent components intercept keyboard events meant for Monaco
- **Solution**: Use `onKeyDownCapture` with `stopPropagation()` ONLY - never `preventDefault()`
- **Location**: [`editor.tsx`](client/src/pages/editor.tsx:147)
- **Warning**: `e.preventDefault()` on Ctrl+A will BLOCK Monaco's select-all, not enable it!

#### 4. **Bulk Deletion Workaround**
- **Problem**: Monaco's bulk delete (Ctrl+A + Delete) doesn't work reliably
- **Solution**: Manual deletion using `executeEdits` API when selection exists
- **Location**: [`editor.tsx`](client/src/pages/editor.tsx:189)
```typescript
if (selection && !selection.isEmpty()) {
  editor.executeEdits('manual-delete', [{
    range: selection,
    text: '',
    forceMoveMarkers: true
  }]);
}
```

#### 5. **Ctrl+A Select All Fix**
- **Problem**: Ctrl+A only selects partial text
- **Solution**: Programmatically force full selection
- **Location**: [`editor.tsx`](client/src/pages/editor.tsx:156)

### 📊 State Management

#### 6. **Monaco as Source of Truth**
- **Problem**: React state and Monaco editor content can diverge
- **Solution**: Always use `editorRef.current?.getValue()` for operations (export, run, etc.)
- **Example**: [`editor.tsx`](client/src/pages/editor.tsx:49)

#### 7. **Sync Flags to Prevent Loops**
- **Problem**: onChange events can trigger infinite update loops
- **Solution**: Use `syncingRef` to ignore events during programmatic updates
- **Location**: [`monaco-editor.tsx`](client/src/components/editor/monaco-editor.tsx:28)

### 🏃 Async & Compilation

#### 8. **Debounced vs Immediate Compilation**
- **Problem**: Run button uses stale story due to debounced compilation
- **Solution**: Add `compileStoryNow()` for immediate, non-debounced compilation
- **Usage**: Run button should compile immediately, typing should debounce

#### 9. **Pass Fresh Story Objects**
- **Problem**: Cached story objects become stale
- **Solution**: Pass freshly compiled story directly to `runStory()`
- **Example**: [`editor.tsx`](client/src/pages/editor.tsx:54)

### 🚨 Common Pitfalls to Avoid

1. **Don't use `preventDefault()` on keyboard events** unless you want to completely block that key
2. **Don't trust React state for editor content** - always check Monaco's value
3. **Don't assume Monaco cleanup is automatic** - manually clear DOM artifacts
4. **Don't ignore StrictMode effects** - they reveal real bugs in production
5. **Don't modify Monaco workarounds** without extensive testing - they're fragile!

### 📝 Testing Checklist for Editor Changes

- [ ] Single character typing/deletion
- [ ] Ctrl+A selects entire document
- [ ] Delete/Backspace on selected text
- [ ] Export functions use current content
- [ ] Run button shows fresh compilation
- [ ] New file clears editor properly
- [ ] No console errors about DOM context

I've documented the critical lessons learned from debugging the InkPad Monaco Editor integration. The key takeaways are:

**Most Important:**
1. React StrictMode creates double Monaco instances - use initialization flags + cleanup delays
2. NEVER use `e.preventDefault()` on Ctrl+A - it blocks Monaco, not enables it
3. Monaco needs manual workarounds for bulk deletion and select-all
4. Always use Monaco's `getValue()` as source of truth, not React state
5. Clear DOM artifacts (`innerHTML = ''`) to prevent context corruption

**Architecture Decisions:**
- Debounced compilation for typing, immediate compilation for Run button
- Pass fresh story objects, not cached ones
- Use sync flags to prevent onChange loops
- Capture phase event handling with careful `stopPropagation()`

These patterns are fragile but necessary due to Monaco's complex DOM management and React's StrictMode behavior. Any future refactoring should preserve these workarounds and test thoroughly with the provided checklist.

---

## 🔄 Worker Communication Contract

### 10. **Critical Worker Communication Bug**
- **Problem**: Changing worker to send parsed objects instead of JSON strings
- **Symptom**: `"[object Object]" is not valid JSON` compilation errors
- **Root Cause**: Broken contract between worker and main thread
- **Solution**: Maintain explicit JSON string contract with clear documentation

#### **The Bug Timeline:**
1. ✅ Worker originally sent JSON strings
2. ❌ "Improved" worker to send parsed objects (seemed logical)
3. 💥 Main thread expected strings, got objects → `"[object Object]"` error
4. ✅ Fixed by reverting worker + adding robust JSON handling

### 11. **Worker Communication Contract Rules**

#### **CRITICAL: Always Document Data Contracts**
- **Location**: [`types/worker-messages.ts`](client/src/types/worker-messages.ts)
- **Rule**: Both sides must agree on data format (string vs object)
- **Implementation**: Use TypeScript interfaces to make contracts explicit

```typescript
// GOOD: Explicit contract
interface CompilerWorkerSuccessMessage {
  ok: true;
  json: string; // JSON STRING, not object!
}
```

#### **Worker Side Comments**
- **Location**: [`ink-compiler.worker.ts`](client/src/workers/ink-compiler.worker.ts)
- **Rule**: Document what format you're sending

```typescript
// IMPORTANT: This worker sends JSON STRINGS to the main thread
// DO NOT change this to send parsed objects without updating receiver
```

#### **Main Thread Comments**
- **Location**: [`ink-compiler.ts`](client/src/lib/ink-compiler.ts)
- **Rule**: Document what format you expect

```typescript
// IMPORTANT: Expects JSON STRING from worker, not parsed object
// The worker sends stringified JSON - if this changes, update both sides
```

### 12. **Architecture Decision Record (ADR)**

#### **Decision: Worker Communication Uses JSON Strings**
- **Rationale**: Clear boundary between worker and main thread
- **Trade-off**: Slight performance cost for JSON.parse/stringify vs. type safety
- **Alternative Considered**: Direct object passing (caused "[object Object]" bug)
- **Benefit**: Robust handling of JSON from any source (imports, API, etc.)

#### **Why Not Objects?**
1. **Structured Cloning Complexity**: Browser's structured cloning can have edge cases
2. **Type Uncertainty**: Hard to know if you're getting string or object
3. **Import Compatibility**: External JSON sources are always strings
4. **Clear Boundaries**: Explicit serialization makes contracts obvious

### 🧪 Testing Considerations

#### **Smoke Test for Default Story**
```typescript
// This test would have caught the "[object Object]" bug immediately
test('default ink story should compile without errors', async () => {
  const result = await compileInkScript(DEFAULT_STORY);
  expect(result.errors).toHaveLength(0);
  expect(result.story).not.toBeNull();
});
```

#### **Worker Contract Test**
```typescript
test('worker sends JSON string, not object', async () => {
  const result = await compileInkViaWorker('Hello world');
  expect(typeof result).toBe('string');
  expect(() => JSON.parse(result)).not.toThrow();
});
```

### 📋 Code Review Checklist

#### **For Any PR Touching Worker Communication:**
- [ ] Updated both sender AND receiver?
- [ ] Tested with actual compilation, not just TypeScript checks?
- [ ] Documented the data contract in comments?
- [ ] Updated TypeScript interfaces if contract changed?
- [ ] Added/updated tests that verify the contract?
- [ ] Verified exports still work (they depend on rawJSON)?

#### **Red Flags to Watch For:**
- Changing `JSON.parse()` to direct object assignment
- Removing "redundant" JSON.stringify calls
- Making workers "more efficient" by skipping serialization
- TypeScript errors about string vs object types

### 🚨 Updated Common Pitfalls

6. **Don't break worker contracts** - document data formats explicitly
7. **Don't optimize away JSON serialization** - it provides clear boundaries
8. **Don't trust "obvious" improvements** - test actual compilation flow
9. **Don't ignore TypeScript string vs object warnings** - they reveal contract issues

### 📝 Updated Testing Checklist

#### **For Worker Communication Changes:**
- [ ] Default story compiles successfully
- [ ] Custom stories with variables compile
- [ ] Export functionality still works
- [ ] Import functionality handles strings correctly
- [ ] No "[object Object]" errors in console
- [ ] TypeScript compilation passes without warnings