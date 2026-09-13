M.BizAccount code organization notes

The existing index.html remains the application source of truth. Future refactors should move CSS and JavaScript into separate files only through verified, incremental changes so the current accounting, invoice, keyboard and storage behaviour stays intact.

Recommended target structure:
- index.html: page shell and app mount
- assets/css/app.css: application styles
- assets/js/data.js: localStorage/data model helpers
- assets/js/ui.js: rendering/navigation helpers
- assets/js/invoices.js: invoice/voucher logic
- assets/js/reports.js: reporting logic
- assets/js/keyboard.js: keyboard gateway/shortcuts
- assets/js/auth.js: Supabase authentication

Do not delete or simplify existing functionality during this refactor.
