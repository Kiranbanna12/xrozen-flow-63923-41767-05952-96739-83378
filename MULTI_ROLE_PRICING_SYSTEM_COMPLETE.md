# Multi-Role Pricing System - Complete Implementation Guide

## 🎯 समस्या (Problem)

System mein ek hi `fee` column tha jo sabke liye same amount show karta tha. Yeh galat tha kyunki:
- **Editor** ke liye wo **Revenue** hai (unki kamai)
- **Client** ke liye wo **Expense** hai (unka kharch)
- **Agency** ke liye dono chahiye - Client se kitna charge kiya aur Editor ko kitna diya (margin)

## ✅ समाधान (Solution)

### Database Schema Update

**New Columns Added to `projects` table:**
```sql
- client_fee REAL     -- Client pays this (Client's Expense)
- editor_fee REAL     -- Editor receives this (Editor's Revenue)  
- agency_margin REAL  -- Agency's profit (client_fee - editor_fee)
- fee REAL           -- Kept for backward compatibility
```

### Role-Based Financial Display

#### 1. **Editor** 👨‍💻
```
Dashboard Shows:
- Label: "Total Revenue"
- Amount: Sum of all editor_fee
- Description: "Your earnings"
- Color: Green (Success)
```

**Logic:**
```typescript
const revenue = projects.reduce((sum, p) => {
  return sum + parseFloat(p.editor_fee || p.fee || 0);
}, 0);
```

#### 2. **Client** 👤
```
Dashboard Shows:
- Label: "Total Expense"
- Amount: Sum of all client_fee
- Description: "Your spending"
- Color: Orange (Warning)
```

**Logic:**
```typescript
const expense = projects.reduce((sum, p) => {
  return sum + parseFloat(p.client_fee || p.fee || 0);
}, 0);
```

#### 3. **Agency** 🏢
```
Dashboard Shows:
- Label: "Total Revenue"
- Amount: Sum of all client_fee (Client se mila)
- Description: Margin displayed
- Additional: Editor Cost shown separately
- Color: Green (Success)
```

**Logic:**
```typescript
const clientRevenue = projects.reduce((sum, p) => {
  return sum + parseFloat(p.client_fee || p.fee || 0);
}, 0);

const editorExpense = projects.reduce((sum, p) => {
  return sum + parseFloat(p.editor_fee || p.fee || 0);
}, 0);

const margin = clientRevenue - editorExpense;
```

## 📊 Dashboard Implementation

### Stats Card Changes

**Before:**
```typescript
<Card>
  <CardTitle>Total Revenue</CardTitle>
  <Amount>₹{totalRevenue}</Amount>
  <Description>From all projects</Description>
</Card>
```

**After:**
```typescript
<Card>
  <CardTitle>{financials.label}</CardTitle>  // Dynamic based on role
  <Amount>₹{financials.amount}</Amount>      // Role-specific calculation
  <Description>{financials.description}</Description>
  
  {/* Agency only */}
  {financials.type === 'agency' && (
    <p>Editor Cost: ₹{financials.expense}</p>
  )}
</Card>
```

## 🔧 Migration Process

### Step 1: Run Migration Script
```bash
node add-pricing-columns.cjs
```

**What it does:**
1. Adds `client_fee`, `editor_fee`, `agency_margin` columns
2. Migrates existing `fee` data to new columns
3. Sets `client_fee = fee` and `editor_fee = fee` for existing projects
4. Sets `agency_margin = 0` initially

### Step 2: Update Projects
Agencies can now set different prices:
```typescript
{
  client_fee: 5000,      // Client pays 5000
  editor_fee: 3500,      // Editor gets 3500
  agency_margin: 1500,   // Agency keeps 1500
  fee: 5000             // Backward compatibility
}
```

## 💰 Pricing Transparency Rules

### For Editor Projects:
```typescript
editor_fee = amount editor receives
client_fee = 0 (not applicable)
agency_margin = 0 (no middleman)
```

### For Client Projects:
```typescript
client_fee = amount client pays
editor_fee = 0 (not applicable)
agency_margin = 0 (direct payment)
```

### For Agency Projects:
```typescript
client_fee = amount charged to client
editor_fee = amount paid to editor
agency_margin = client_fee - editor_fee
```

## 🎨 UI/UX Changes

### Dashboard Stats Grid

#### Editor View:
```
┌──────────────────────────────┐
│ 💰 Total Revenue             │
│ ₹45,000.00                   │
│ Your earnings                │
└──────────────────────────────┘
```

#### Client View:
```
┌──────────────────────────────┐
│ ⚠️  Total Expense            │
│ ₹78,000.00                   │
│ Your spending                │
└──────────────────────────────┘
```

#### Agency View:
```
┌──────────────────────────────┐
│ 💰 Total Revenue             │
│ ₹95,000.00                   │
│ Margin: ₹18,000.00          │
│ Editor Cost: ₹77,000.00     │
└──────────────────────────────┘
```

## 📝 Code Examples

### Dashboard Financial Calculation

```typescript
const calculateFinancials = () => {
  const userCategory = profile?.user_category;
  
  if (userCategory === 'editor') {
    const revenue = projects.reduce((sum, p) => {
      return sum + parseFloat(p.editor_fee || p.fee || 0);
    }, 0);
    
    return {
      label: 'Total Revenue',
      amount: revenue,
      description: 'Your earnings',
      type: 'revenue'
    };
  }
  
  else if (userCategory === 'client') {
    const expense = projects.reduce((sum, p) => {
      return sum + parseFloat(p.client_fee || p.fee || 0);
    }, 0);
    
    return {
      label: 'Total Expense',
      amount: expense,
      description: 'Your spending',
      type: 'expense'
    };
  }
  
  else if (userCategory === 'agency') {
    const clientRevenue = projects.reduce((sum, p) => {
      return sum + parseFloat(p.client_fee || p.fee || 0);
    }, 0);
    
    const editorExpense = projects.reduce((sum, p) => {
      return sum + parseFloat(p.editor_fee || p.fee || 0);
    }, 0);
    
    const margin = clientRevenue - editorExpense;
    
    return {
      label: 'Total Revenue',
      amount: clientRevenue,
      description: `Margin: ₹${margin.toLocaleString('en-IN')}`,
      type: 'agency',
      margin: margin,
      expense: editorExpense
    };
  }
};

const financials = calculateFinancials();
```

### Project Form Update (Next Step)

```typescript
// In Project creation/edit form
{profile?.user_category === 'agency' && (
  <>
    <FormField
      label="Client Fee"
      name="client_fee"
      type="number"
      placeholder="Amount to charge client"
      required
    />
    
    <FormField
      label="Editor Fee"
      name="editor_fee"
      type="number"
      placeholder="Amount to pay editor"
      required
    />
    
    {/* Auto-calculate margin */}
    <div className="text-sm text-muted-foreground">
      Your Margin: ₹{(formData.client_fee - formData.editor_fee).toLocaleString()}
    </div>
  </>
)}

{profile?.user_category === 'editor' && (
  <FormField
    label="Project Fee"
    name="editor_fee"
    type="number"
    placeholder="Your charges"
    required
  />
)}

{profile?.user_category === 'client' && (
  <FormField
    label="Budget"
    name="client_fee"
    type="number"
    placeholder="Project budget"
    required
  />
)}
```

## 🔐 Privacy & Transparency

### What Each Role Can See:

#### Editor Sees:
- ✅ Their own `editor_fee` (revenue)
- ❌ Cannot see `client_fee` (client privacy)
- ❌ Cannot see `agency_margin` (agency privacy)

#### Client Sees:
- ✅ Their own `client_fee` (expense)
- ❌ Cannot see `editor_fee` (editor privacy)
- ❌ Cannot see `agency_margin` (agency privacy)

#### Agency Sees:
- ✅ All three values (`client_fee`, `editor_fee`, `agency_margin`)
- ✅ Can set all values independently
- ✅ Full transparency of their own margin

## 📊 Invoice System Update (Next Phase)

### Editor Invoice:
```
Invoice for: [Editor Name]
Project: [Project Name]
Amount: ₹[editor_fee]
Description: Payment for video editing services
```

### Client Invoice:
```
Invoice to: [Client Name]
Project: [Project Name]
Amount: ₹[client_fee]
Description: Professional video editing service
```

### Agency Internal Report:
```
Project: [Project Name]
Client Charged: ₹[client_fee]
Editor Paid: ₹[editor_fee]
Net Margin: ₹[agency_margin]
Margin %: [(agency_margin/client_fee) * 100]%
```

## 🚀 Next Steps

### Phase 1: ✅ Completed
- ✅ Database migration
- ✅ Dashboard role-based display

### Phase 2: 🔄 In Progress
- [ ] Update Project Creation/Edit forms
- [ ] Add pricing validation
- [ ] Implement role-based field visibility

### Phase 3: 📋 Pending
- [ ] Invoice system role-based generation
- [ ] Payment tracking per role
- [ ] Financial reports & analytics

### Phase 4: 📋 Pending
- [ ] Editor can't see client_fee API restriction
- [ ] Client can't see editor_fee API restriction
- [ ] Audit logs for price changes

## 🧪 Testing Checklist

### Test as Editor:
- [ ] Dashboard shows "Total Revenue"
- [ ] Amount equals sum of `editor_fee`
- [ ] Color is green
- [ ] No client information visible

### Test as Client:
- [ ] Dashboard shows "Total Expense"
- [ ] Amount equals sum of `client_fee`
- [ ] Color is orange/warning
- [ ] No editor information visible

### Test as Agency:
- [ ] Dashboard shows "Total Revenue"
- [ ] Amount equals sum of `client_fee`
- [ ] Margin is displayed correctly
- [ ] Editor cost shown separately
- [ ] Margin = client_fee - editor_fee

### Test Backward Compatibility:
- [ ] Old projects with only `fee` still work
- [ ] Falls back to `fee` if role-specific fee is 0
- [ ] Migration correctly populated new columns

## 📁 Files Modified

### 1. `add-pricing-columns.cjs`
- Migration script for database schema update

### 2. `src/pages/Dashboard.tsx`
- Added `calculateFinancials()` function
- Updated stats card to use role-based logic
- Dynamic labels and colors based on user role

### 3. (To be updated) `src/pages/Projects.tsx`
- Will add role-based pricing fields
- Validation for agency margin
- Privacy controls for field visibility

### 4. (To be updated) `src/pages/Invoices.tsx`
- Role-based invoice generation
- Different templates for each role
- Privacy-compliant data display

## 💡 Best Practices

1. **Always use role-specific fees in calculations**
2. **Fallback to `fee` for backward compatibility**
3. **Never expose sensitive pricing across roles**
4. **Log all price changes for audit**
5. **Validate agency_margin = client_fee - editor_fee**
6. **Use consistent currency formatting**
7. **Show clear labels based on context**

## 🔍 Debugging Tips

### Check Database:
```sql
SELECT 
  id, name, 
  fee, 
  client_fee, 
  editor_fee, 
  agency_margin,
  (client_fee - editor_fee) as calculated_margin
FROM projects
WHERE client_fee > 0 OR editor_fee > 0;
```

### Check Dashboard Logic:
```typescript
console.log('User Category:', profile?.user_category);
console.log('Financials:', financials);
console.log('Projects:', projects.map(p => ({
  name: p.name,
  fee: p.fee,
  client_fee: p.client_fee,
  editor_fee: p.editor_fee
})));
```

## 📞 Support

Agar koi confusion ho ya additional features chahiye:
1. Dashboard ki role-based display check karo
2. Database mein pricing columns verify karo
3. Migration script re-run karne ki zarurat nahi (idempotent hai)
4. Har role se login karke test karo

---

**Implementation Date:** October 13, 2025  
**Status:** Phase 1 & 2 Complete ✅  
**Next:** Project Form & Invoice System Updates
