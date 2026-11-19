# Mini ERP – Inventory Management

A small inventory system for **Capitalist SL** (demo company). Add products, receive and issue stock, keep every movement on record, and see the numbers update live on a dashboard.

There is no server. All data is sample data that is saved in browser (LocalStorage), so it is still there when you reload
## Run it

You need Node.js 20 or newer.
## What you can do

Dashboard total products, total stock, inventory value, low-stock and out-of-stock counts, charts (stock by category, stock status, movements per day), recent activity, and lists of products that need restocking. Everything updates the moment data changes. Chart bars and slices are clickable and open the matching filtered product list.

Products – table with add, edit, delete and a detail page. Search by name or code, filter by category and stock status, sort by clicking column headings, pagination, export to CSV. Each product has name, SKU, category, description, unit price, quantity, minimum stock and creation date.

Stock – receive and issue stock, a full movement history (with the quantity before and after), and a history on each product page with a stock-level graph. Rules that are always enforced:
- quantity can never go below zero
- you cannot issue more than what is available
- every movement is written to the history
- the status (in stock / low stock / out of stock) changes by itself

Categories add, edit, and delete (only when no product uses the category).

xtras – press **Ctrl + K** to search and jump anywhere or start an action; **Undo** button after deleting a product or category; stock bars; collapsible sidebar; toast messages for every action; confirm window before anything is deleted; loading, empty and error screens; **Reset demo data** button in the sidebar.

## Technologies

React 19 · TypeScript · Tailwind CSS · Redux Toolkit · React Router · Framer Motion · AOS · Lucide React · Recharts (charts) · Vitest (unit tests) · Vite

## Folder structure
src/
  components/
    layout/     sidebar, page frame, Ctrl+K search panel, quick actions
    ui/         buttons, form fields, dialogs, toasts, badges, pagination…
  features/
    dashboard/  dashboard page, stat cards, charts
    products/   list, form, detail page, stock graph
    stock/      receive/issue form, movement history
    categories/ list and form
  store/        Redux slices, thunks (the business rules), selectors, saving
  lib/          stock maths, validation, CSV export, formatting
  data/         sample data and company name
  types/        shared TypeScript types
e2e/            browser test script (Playwright)
docs/           screenshots and raw test results
```

## How it is built 

- The stock rules live in the Redux actions, not only in the forms, so stock cannot go negative even if a form is bypassed.
- Data is saved under the LocalStorage key `mini-erp:v1`. If the saved data is damaged, the app starts again from the sample data and tells you.
- Search, filters and sorting are kept in the web address, so a filtered list can be shared or bookmarked.
- The screens are loaded on demand to keep the first load small.
