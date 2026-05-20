# BookingRequest — branch fields reference

English names only in code and schema. Arabic meaning is in the **Function (AR)** column.

## Database (`BookingRequest`)

| Field (EN) | Function (AR) | Notes (EN) |
|------------|---------------|------------|
| `branchId` | فرع **الاستلام** — مكان أخذ العميل للسيارة | FK → `Branch.id`. Used for **statistics** and branch-employee pickup scope. `NULL` when `pickupMode = DELIVERY`. |
| `pickupBranch` | (relation only) | Prisma relation name for `branchId`. Not a DB column. |
| `returnBranchId` | فرع **الإرجاع** — مكان إرجاع السيارة | FK → `Branch.id`. Used for **fleet availability**, **returns page**, stock transfer on inter-branch return. |
| `returnBranch` | (relation only) | Prisma relation name for `returnBranchId`. Not a DB column. |
| `interBranchReturnConfirmedAt` | وقت تأكيد موظف فرع الإرجاع باستلام سيارة قادمة من فرع آخر | When set: +1 fleet at return branch, −1 at pickup branch. |
| `pickupMode` | طريقة الاستلام: من فرع أو توصيل | `BRANCH` \| `DELIVERY`. |

## Removed columns (after migration)

| Old field (EN) | Was used as (AR) | Replaced by |
|----------------|------------------|-------------|
| `branch` (string slug) | كان يُخزَّن غالباً **فرع الإرجاع** | `returnBranchId` |
| `pickupBranchSlug` (string) | فرع الاستلام عند اختلافه عن الإرجاع | `branchId` |

## API / checkout JSON (still English keys)

| Key (EN) | Function (AR) | Maps to DB |
|----------|---------------|------------|
| `branch` | فرع **الإرجاع** (slug) | `returnBranchId` |
| `pickupBranch` or `pickupBranchSlug` | فرع **الاستلام** (slug) | `branchId` (when `pickupMode = BRANCH`) |
| `pickupMode` | استلام من فرع أو توصيل | `pickupMode` |

## TypeScript (`DirectBookingCommon`)

| Property (EN) | Function (AR) | API form field |
|---------------|---------------|----------------|
| `returnBranchSlug` | slug فرع الإرجاع | `branch` |
| `pickupBranchSlug` (on create input) | slug فرع الاستلام | `pickupBranch` |

## Table `Branch`

| Field (EN) | Function (AR) |
|------------|---------------|
| `id` | معرّف الفرع (رقم) |
| `slug` | مفتاح ثابت في الروابط والحجز (مثل `jeddah`) |
| `name` | الاسم المعروض للمستخدم |

## Quick rule

- **`branchId`** = pickup (استلام) → statistics  
- **`returnBranchId`** = return (إرجاع) → stock & returns  
- Do **not** confuse with JSON key `branch`, which means **return** branch slug.
