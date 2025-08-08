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