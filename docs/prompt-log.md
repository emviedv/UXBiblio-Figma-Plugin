# Enhanced Analysis Prompt Log

## 2025-10-14
- `PROMPT_VERSION`: `3.4.2`
- Change: Restored the dedicated UX copywriting task, reintroduced the `uxCopywriting` JSON contract, and clarified copy metadata sanitization requirements.
- Rationale: The Chrome-derived prompt removed the copywriting payload, leaving the UX Copy tab empty. The updated contract keeps UI expectations and prompt output in sync.

## 2025-10-13
- `PROMPT_VERSION`: `3.4.1`
- Change: Replaced the Figma-specific analysis template with the comprehensive Chrome Extension prompt, matching task structure, sources policy, and strict JSON contract.
- Rationale: Keeps AI guidance consistent across products and prevents drift while we consolidate on the shared UXBiblio analysis workflow.

## 2025-10-09
- `PROMPT_VERSION`: `3.5.1-Figma`
- Change: Added explicit "UX Copywriting" task and strict JSON field `uxCopywriting { heading?, summary?, guidance[], sources[] }` to the analysis output.
- Rationale: The plugin UI expects UX copy guidance under `uxCopywriting`/`copywriting`. Prior prompt omitted this key, leaving the "UX Copy" tab without content.

## 2025-10-08
- `PROMPT_VERSION`: `3.5.1-Figma`
- Change: Expanded the system context to cover marketing-style visual assets (for example banners, hero graphics) and require observations to reference frame dimensions, frame names, and on-canvas text/content.
- Rationale: Ensures the analysis engine evaluates non-screen assets accurately and anchors findings in metadata that Figma reliably provides.

## 2025-10-08 (Update 2)
- `PROMPT_VERSION`: `3.5.1-Figma`
- Change: Strengthened the Sources Policy to align citations with asset/industry context, limit domain reuse, and require marketing-oriented references when marketing visuals are analyzed.
- Rationale: Drives more distinctive, context-aware evidence so recommendations feel tailored to the captured frame.
