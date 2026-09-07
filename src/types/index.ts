export type UserRole = 'ADMIN' | 'STAFF';

export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  role: UserRole;
  pinCode: string;
  pin?: string;
  avatar: string;
  isActive: boolean;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  iconName: string;
  sortOrder: number;
  isActive: boolean;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  categoryId: string;
  description: string;
  sellingPrice: number;
  costPrice: number;
  taxRate: number; // in percentage e.g. 5 for 5%
  imageUrl: string;
  stock: number;
  minStock: number;
  unit: string; // e.g. 'pcs', 'cup', 'portion'
  isVeg: boolean;
  isAvailable: boolean;
  isFeatured: boolean;
  createdAt: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  note?: string;
  discountAmount?: number;
}

export type OrderStatus = 'COMPLETED' | 'HELD' | 'CANCELLED' | 'REFUNDED' | 'PENDING_TABLE_QR';
export type PaymentMethod = 'CASH' | 'UPI' | 'CARD' | 'SPLIT' | 'OTHER' | 'PENDING';
export type OrderType = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  birthday?: string;
  address?: string;
  notes?: string;
  totalOrders: number;
  totalSpent: number;
  visitCount?: number;
  lastOrderDate?: string;
  lastVisitDate?: string;
  createdAt: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  sku: string;
  categoryName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  costPrice: number;
  note?: string;
  isVeg: boolean;
}

export interface PaymentDetails {
  method: PaymentMethod;
  amountReceived?: number;
  changeGiven?: number;
  upiReference?: string;
  cardLast4?: string;
  splitDetails?: {
    cashAmount?: number;
    upiAmount?: number;
    cardAmount?: number;
  };
}

export interface Order {
  id: string;
  orderNumber: string; // e.g. CAF-2026-000124
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss
  timestamp: number;
  orderType: OrderType;
  tableNumber?: string;
  items: OrderItem[];
  itemCount: number;
  subtotal: number;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  discountAmount: number;
  discountReason?: string;
  taxType: 'EXCLUSIVE' | 'INCLUSIVE';
  taxRate: number;
  taxAmount: number;
  cgstAmount?: number;
  sgstAmount?: number;
  grandTotal: number;
  paymentMethod: PaymentMethod;
  paymentDetails: PaymentDetails;
  customer?: {
    id?: string;
    name: string;
    phone: string;
  };
  staff: {
    id: string;
    name: string;
    role: UserRole;
  };
  status: OrderStatus;
  notes?: string;
  source?: 'STAFF' | 'CUSTOMER_QR';
  heldOrderId?: string;
  cancelReason?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  refundedAmount?: number;
}

export type KitchenStatus = 'PREPARING' | 'READY' | 'SERVED';

export interface HeldOrder {
  id: string;
  holdNumber: number;
  createdAt: number;
  heldAt?: string;
  orderType: OrderType;
  tableNumber?: string;
  cartItems: CartItem[];
  items?: CartItem[];
  customer?: {
    id?: string;
    name: string;
    phone: string;
  };
  customerId?: string;
  customerName?: string;
  notes?: string;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  discountAmount?: number;
  discountReason?: string;
  subtotal: number;
  grandTotal?: number;
  source?: 'STAFF' | 'CUSTOMER_QR';
  kitchenStatus?: KitchenStatus;
  kitchenStartedAt?: number;
  kitchenReadyAt?: number;
  kitchenServedAt?: number;
  completedItemIndices?: number[];
}

export interface InventoryTransaction {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  type: 'SALE' | 'PURCHASE' | 'DAMAGE' | 'ADJUSTMENT' | 'RETURN_RESTORE';
  quantityChange: number; // positive for addition, negative for reduction
  previousStock: number;
  newStock: number;
  date: string;
  time: string;
  timestamp: number;
  reason: string;
  staffName: string;
  orderNumber?: string;
}

export type InventoryLog = InventoryTransaction;

export interface CafeSettings {
  cafeName: string;
  tagline: string;
  logoUrl: string;
  address: string;
  phone: string;
  email: string;
  gstNumber: string;
  fssaiNumber: string;
  currency: string;
  currencySymbol: string;
  taxRate: number; // Default total tax percentage e.g. 5%
  isTaxInclusive: boolean;
  receiptWidth: '58mm' | '80mm';
  receiptHeader: string;
  receiptFooter: string;
  receiptTerms: string;
  upiId: string; // for dynamic QR code generation
  enableSound: boolean;
  autoPrintReceipt: boolean;
  allowNegativeStock: boolean;
  requirePinForDiscount: boolean;
  maxDiscountWithoutPin: number; // percent e.g. 15%
  tables?: string[];
  customerMenuBaseUrl?: string; // Public/shared URL for table QR codes so mobile devices do not get 403
}

export interface AuditLog {
  id: string;
  timestamp: number;
  date: string;
  time: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  entity: 'ORDER' | 'PRODUCT' | 'CATEGORY' | 'INVENTORY' | 'CUSTOMER' | 'SETTING' | 'AUTH' | 'STAFF';
  entityId?: string;
  details: string;
}
