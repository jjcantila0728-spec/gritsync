# Refactoring Guide

## Overview

This project follows a strict refactoring policy to maintain code quality, organization, and maintainability. All changes are automatically refactored to ensure consistency.

## Refactoring Principles

### 1. **Non-Destructive Changes**
- All refactoring must preserve existing functionality
- Database migrations use `IF NOT EXISTS`, `IF EXISTS`, and `OR REPLACE` clauses
- No breaking changes to API endpoints
- Backward compatibility is maintained

### 2. **File Organization**

#### SQL Files
- **`supabase/schema.sql`** - Source of truth for database schema
- **`supabase/migrations/`** - Versioned database migrations
- **`supabase/patches/`** - One-off fixes and patches (archived)

#### Server Code
- **`server/index.js`** - Main server entry point
- **`server/routes/`** - Route modules (one file per resource)
- **`server/middleware/`** - Middleware functions
- **`server/services/`** - External service integrations
- **`server/utils/`** - Utility functions
- **`server/db/`** - Database initialization

#### Frontend Code
- **`src/pages/`** - Page components
- **`src/components/`** - Reusable components
- **`src/lib/`** - Library code and utilities
- **`src/contexts/`** - React contexts

#### Documentation
- **`docs/`** - Project documentation
- **`docs/archive/`** - Archived/old documentation

### 3. **Automatic Refactoring Rules**

When making changes, automatically apply:

1. **Code Organization**
   - Extract large functions into separate modules
   - Group related functionality together
   - Use consistent naming conventions

2. **SQL Migrations**
   - Always use `IF NOT EXISTS` for table/column creation
   - Use `IF EXISTS` for drops
   - Use `OR REPLACE` for functions
   - Include rollback instructions in comments

3. **Route Organization**
   - One route file per resource (e.g., `applications.js`, `quotations.js`)
   - Keep route files under 500 lines
   - Extract complex logic into service modules

4. **Component Organization**
   - One component per file
   - Extract reusable logic into hooks
   - Keep components focused and single-purpose

5. **Documentation**
   - Update relevant docs when making changes
   - Archive old documentation instead of deleting
   - Keep README.md up to date

## Refactoring Checklist

Before committing changes:

- [ ] Code is organized into appropriate directories
- [ ] No duplicate code exists
- [ ] Functions are appropriately sized (< 100 lines)
- [ ] SQL migrations are non-destructive
- [ ] Documentation is updated
- [ ] Old/unused files are archived, not deleted
- [ ] All imports/exports are correct
- [ ] No linter errors

## Current Project Structure

```
GRITSYNC/
├── supabase/
│   ├── schema.sql              # Source of truth
│   ├── migrations/             # Versioned migrations
│   ├── patches/                # Archived patches
│   └── functions/             # Edge functions
├── server/
│   ├── index.js               # Main entry
│   ├── routes/                # Route modules
│   ├── middleware/            # Middleware
│   ├── services/             # External services
│   ├── utils/                # Utilities
│   └── db/                   # Database
├── src/
│   ├── pages/                # Page components
│   ├── components/           # Reusable components
│   ├── lib/                  # Libraries
│   └── contexts/             # React contexts
└── docs/
    ├── REFACTORING_GUIDE.md  # This file
    └── archive/              # Archived docs
```

## Migration Strategy

### SQL Migrations
1. Create migration file in `supabase/migrations/` with timestamp
2. Use non-destructive SQL (IF NOT EXISTS, etc.)
3. Update `schema.sql` to reflect changes
4. Test migration on development database first

### Code Refactoring
1. Extract code into appropriate modules
2. Update imports across codebase
3. Test all affected functionality
4. Update documentation

## Best Practices

1. **Always refactor incrementally** - Small, focused changes
2. **Test after each refactoring** - Ensure nothing breaks
3. **Document changes** - Update relevant documentation
4. **Archive, don't delete** - Keep history in docs/archive
5. **Maintain backward compatibility** - Don't break existing functionality

## Questions?

If unsure about refactoring approach:
1. Check this guide
2. Review similar refactoring in codebase
3. Follow the principle: "If it works, make it better without breaking it"


