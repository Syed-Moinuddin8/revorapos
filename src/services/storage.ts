import {
  Category,
  Product,
  User,
  Customer,
  Order,
  HeldOrder,
  CafeSettings,
  AuditLog,
  InventoryTransaction,
  CartItem,
  PaymentMethod,
  PaymentDetails,
  OrderType,
} from '../types';

import {
  INITIAL_CATEGORIES,
  INITIAL_PRODUCTS,
  INITIAL_USERS,
  INITIAL_CUSTOMERS,
  INITIAL_SETTINGS,
  INITIAL_ORDERS,
  INITIAL_AUDIT_LOGS,
  INITIAL_INVENTORY_TXNS,
} from '../data/initialData';
import { posDb } from '../server/db';

const STORAGE_KEYS = {
  CATEGORIES: 'cafe_pos_categories_v2',
  PRODUCTS: 'cafe_pos_products_v2',
  USERS: 'cafe_pos_users_v1',
  CUSTOMERS: 'cafe_pos_customers_v1',
  SETTINGS: 'cafe_pos_settings_v1',
  ORDERS: 'cafe_pos_orders_v1',
  HELD_ORDERS: 'cafe_pos_held_orders_v1',
  AUDIT_LOGS: 'cafe_pos_audit_logs_v1',
  INVENTORY_TXNS: 'cafe_pos_inventory_txns_v1',
  CURRENT_USER: 'cafe_pos_current_user_v1',
  ORDER_SEQUENCE: 'cafe_pos_order_seq_v1',
  DELETED_HELD_ORDER_IDS: 'cafe_pos_deleted_held_ids_v1',
  DELETED_PRODUCT_IDS: 'cafe_pos_deleted_prod_ids_v1',
  DELETED_CATEGORY_IDS: 'cafe_pos_deleted_cat_ids_v1',
};

function safeGetItem<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    if (!item) return defaultValue;
    return JSON.parse(item);
  } catch {
    return defaultValue;
  }
}

function safeSetItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Error saving to localStorage key ${key}`, err);
  }
}

class PosStorageService {
  constructor() {
    this.initializeIfEmpty();
  }

  public initializeIfEmpty() {
    if (!localStorage.getItem(STORAGE_KEYS.PRODUCTS)) {
      safeSetItem(STORAGE_KEYS.CATEGORIES, INITIAL_CATEGORIES);
      safeSetItem(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);
      safeSetItem(STORAGE_KEYS.USERS, INITIAL_USERS);
      safeSetItem(STORAGE_KEYS.CUSTOMERS, INITIAL_CUSTOMERS);
      safeSetItem(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS);
      safeSetItem(STORAGE_KEYS.ORDERS, INITIAL_ORDERS);
      safeSetItem(STORAGE_KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS);
      safeSetItem(STORAGE_KEYS.INVENTORY_TXNS, INITIAL_INVENTORY_TXNS);
      safeSetItem(STORAGE_KEYS.HELD_ORDERS, []);
      safeSetItem(STORAGE_KEYS.ORDER_SEQUENCE, 105);
    }
  }

  // ====================== AUTH & USERS ======================
  public getCurrentUser(): User | null {
    const current = safeGetItem<User | null>(STORAGE_KEYS.CURRENT_USER, null);
    if (current && (current.role === 'ADMIN' || current.role === 'STAFF')) {
      // Normalize names and passwords to requested values
      if (current.role === 'ADMIN' && (current.name !== 'Admin' || current.pinCode !== 'Bharath@650')) {
        const updatedAdmin = { ...current, name: 'Admin', username: 'admin', pinCode: 'Bharath@650' };
        safeSetItem(STORAGE_KEYS.CURRENT_USER, updatedAdmin);
        return updatedAdmin;
      }
      if (current.role === 'STAFF' && (current.name !== 'Staff' || current.pinCode !== 'Staff@87')) {
        const updatedStaff = { ...current, name: 'Staff', username: 'staff', pinCode: 'Staff@87' };
        safeSetItem(STORAGE_KEYS.CURRENT_USER, updatedStaff);
        return updatedStaff;
      }
      return current;
    }
    return null;
  }

  public getActiveUserFallback(): User {
    return this.getCurrentUser() || INITIAL_USERS[0];
  }

  public logoutUser(): void {
    const current = this.getCurrentUser();
    if (current) {
      this.addAuditLog({
        userId: current.id,
        userName: current.name,
        userRole: current.role,
        action: 'USER_LOGOUT',
        entity: 'AUTH',
        details: `User ${current.name} (${current.role}) logged out`,
      });
    }
    try {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    } catch {
      // Ignore localStorage exceptions
    }
  }

  public setCurrentUser(user: User): void {
    safeSetItem(STORAGE_KEYS.CURRENT_USER, user);
    this.addAuditLog({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: 'USER_LOGIN',
      entity: 'AUTH',
      details: `User ${user.name} logged in with role ${user.role}`,
    });
  }

  public getUsers(): User[] {
    const stored = safeGetItem<User[]>(STORAGE_KEYS.USERS, INITIAL_USERS);
    let valid = (Array.isArray(stored) ? stored : []).filter(
      (u) => u && (u.role === 'ADMIN' || u.role === 'STAFF')
    );
    if (valid.length === 0) {
      safeSetItem(STORAGE_KEYS.USERS, INITIAL_USERS);
      return INITIAL_USERS;
    }
    let updated = false;
    valid = valid.map((u) => {
      if (u.role === 'ADMIN' && (u.name !== 'Admin' || u.pinCode !== 'Bharath@650')) {
        updated = true;
        return { ...u, name: 'Admin', username: 'admin', pinCode: 'Bharath@650' };
      }
      if (u.role === 'STAFF' && (u.name !== 'Staff' || u.pinCode !== 'Staff@87')) {
        updated = true;
        return { ...u, name: 'Staff', username: 'staff', pinCode: 'Staff@87' };
      }
      return u;
    });
    if (updated || valid.length !== (stored?.length || 0)) {
      safeSetItem(STORAGE_KEYS.USERS, valid);
    }
    return valid;
  }

  public saveUser(user: User): void {
    const users = this.getUsers();
    const index = users.findIndex((u) => u.id === user.id);
    if (index >= 0) {
      users[index] = user;
    } else {
      users.push(user);
    }
    safeSetItem(STORAGE_KEYS.USERS, users);
    const currentUser = this.getActiveUserFallback();
    this.addAuditLog({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action: index >= 0 ? 'USER_UPDATED' : 'USER_CREATED',
      entity: 'STAFF',
      entityId: user.id,
      details: `Staff member ${user.name} (${user.role}) was ${index >= 0 ? 'updated' : 'created'}`,
    });
  }

  public deleteUser(userId: string): boolean {
    const users = this.getUsers();
    const target = users.find((u) => u.id === userId);
    if (!target) return false;
    const filtered = users.filter((u) => u.id !== userId);
    safeSetItem(STORAGE_KEYS.USERS, filtered);
    const currentUser = this.getActiveUserFallback();
    this.addAuditLog({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action: 'USER_DELETED',
      entity: 'STAFF',
      entityId: userId,
      details: `Deleted staff member: ${target.name}`,
    });
    return true;
  }

  public getDeletedProductIds(): string[] {
    return safeGetItem<string[]>(STORAGE_KEYS.DELETED_PRODUCT_IDS, []);
  }

  public getDeletedCategoryIds(): string[] {
    return safeGetItem<string[]>(STORAGE_KEYS.DELETED_CATEGORY_IDS, []);
  }

  // ====================== CATEGORIES ======================
  public getCategories(): Category[] {
    const raw = safeGetItem<Category[]>(STORAGE_KEYS.CATEGORIES, INITIAL_CATEGORIES);
    const deletedIds = new Set(this.getDeletedCategoryIds());
    return raw.filter((c) => c && c.id && !deletedIds.has(c.id));
  }

  public saveCategory(category: Category): void {
    const deleted = this.getDeletedCategoryIds().filter((id) => id !== category.id);
    safeSetItem(STORAGE_KEYS.DELETED_CATEGORY_IDS, deleted);

    const categories = safeGetItem<Category[]>(STORAGE_KEYS.CATEGORIES, INITIAL_CATEGORIES);
    const index = categories.findIndex((c) => c.id === category.id);
    if (index >= 0) {
      categories[index] = category;
    } else {
      categories.push(category);
    }
    safeSetItem(STORAGE_KEYS.CATEGORIES, categories);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pos_menu_updated'));
    }
  }

  public deleteCategory(categoryId: string): boolean {
    const deleted = this.getDeletedCategoryIds();
    if (!deleted.includes(categoryId)) {
      deleted.push(categoryId);
      safeSetItem(STORAGE_KEYS.DELETED_CATEGORY_IDS, deleted);
    }
    const categories = safeGetItem<Category[]>(STORAGE_KEYS.CATEGORIES, INITIAL_CATEGORIES);
    const filtered = categories.filter((c) => c.id !== categoryId);
    safeSetItem(STORAGE_KEYS.CATEGORIES, filtered);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pos_menu_updated'));
    }
    return true;
  }

  // ====================== PRODUCTS ======================
  public getProducts(): Product[] {
    const raw = safeGetItem<Product[]>(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);
    const deletedIds = new Set(this.getDeletedProductIds());
    return raw.filter((p) => p && p.id && !deletedIds.has(p.id));
  }

  public getProductById(id: string): Product | undefined {
    return this.getProducts().find((p) => p.id === id);
  }

  public saveProduct(product: Product): void {
    const deleted = this.getDeletedProductIds().filter((id) => id !== product.id);
    safeSetItem(STORAGE_KEYS.DELETED_PRODUCT_IDS, deleted);

    const products = safeGetItem<Product[]>(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);
    const index = products.findIndex((p) => p.id === product.id);
    const isNew = index < 0;
    if (isNew) {
      products.push(product);
    } else {
      products[index] = product;
    }
    safeSetItem(STORAGE_KEYS.PRODUCTS, products);

    const currentUser = this.getActiveUserFallback();
    this.addAuditLog({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action: isNew ? 'PRODUCT_CREATED' : 'PRODUCT_UPDATED',
      entity: 'PRODUCT',
      entityId: product.id,
      details: `${isNew ? 'Added new' : 'Updated'} product: ${product.name} (SKU: ${product.sku}, Price: ₹${product.sellingPrice})`,
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pos_menu_updated'));
    }
  }

  public deleteProduct(productId: string): boolean {
    const deleted = this.getDeletedProductIds();
    if (!deleted.includes(productId)) {
      deleted.push(productId);
      safeSetItem(STORAGE_KEYS.DELETED_PRODUCT_IDS, deleted);
    }
    const products = safeGetItem<Product[]>(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);
    const target = products.find((p) => p.id === productId);
    const filtered = products.filter((p) => p.id !== productId);
    safeSetItem(STORAGE_KEYS.PRODUCTS, filtered);

    const currentUser = this.getActiveUserFallback();
    this.addAuditLog({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action: 'PRODUCT_DELETED',
      entity: 'PRODUCT',
      entityId: productId,
      details: target ? `Deleted product: ${target.name} (SKU: ${target.sku})` : `Deleted product ${productId}`,
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pos_menu_updated'));
    }
    return true;
  }

  // ====================== CUSTOMERS ======================
  public getCustomers(): Customer[] {
    return safeGetItem<Customer[]>(STORAGE_KEYS.CUSTOMERS, INITIAL_CUSTOMERS);
  }

  public getCustomerById(id: string): Customer | undefined {
    return this.getCustomers().find((c) => c.id === id);
  }

  public saveCustomer(customer: Customer): Customer {
    const customers = this.getCustomers();
    const index = customers.findIndex((c) => c.id === customer.id || (c.phone && c.phone === customer.phone));
    if (index >= 0) {
      customers[index] = { ...customers[index], ...customer };
      safeSetItem(STORAGE_KEYS.CUSTOMERS, customers);
      return customers[index];
    } else {
      const newCust = {
        ...customer,
        id: customer.id || `cust_${Date.now()}`,
        createdAt: customer.createdAt || new Date().toISOString().split('T')[0],
        totalOrders: customer.totalOrders || 0,
        totalSpent: customer.totalSpent || 0,
      };
      customers.push(newCust);
      safeSetItem(STORAGE_KEYS.CUSTOMERS, customers);
      return newCust;
    }
  }

  // ====================== INVENTORY ======================
  public getInventoryTransactions(): InventoryTransaction[] {
    return safeGetItem<InventoryTransaction[]>(STORAGE_KEYS.INVENTORY_TXNS, INITIAL_INVENTORY_TXNS);
  }

  public adjustStock(
    productId: string,
    quantityChange: number,
    type: 'PURCHASE' | 'DAMAGE' | 'ADJUSTMENT',
    reason: string,
    staffName: string
  ): Product {
    const products = this.getProducts();
    const product = products.find((p) => p.id === productId);
    if (!product) throw new Error('Product not found');

    const previousStock = product.stock;
    const newStock = Math.max(0, previousStock + quantityChange);
    product.stock = newStock;
    safeSetItem(STORAGE_KEYS.PRODUCTS, products);

    const now = new Date();
    const txn: InventoryTransaction = {
      id: `itx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      type,
      quantityChange,
      previousStock,
      newStock,
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().split(' ')[0],
      timestamp: now.getTime(),
      reason,
      staffName,
    };

    const txns = this.getInventoryTransactions();
    txns.unshift(txn);
    safeSetItem(STORAGE_KEYS.INVENTORY_TXNS, txns);

    const currentUser = this.getActiveUserFallback();
    this.addAuditLog({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action: 'STOCK_ADJUSTED',
      entity: 'INVENTORY',
      entityId: productId,
      details: `${product.name} stock changed by ${quantityChange > 0 ? '+' : ''}${quantityChange} (${previousStock} -> ${newStock}). Reason: ${reason}`,
    });

    return product;
  }

  // ====================== ORDERS & ATOMIC TRANSACTIONS ======================
  public getOrders(): Order[] {
    return safeGetItem<Order[]>(STORAGE_KEYS.ORDERS, INITIAL_ORDERS);
  }

  public getOrderById(orderId: string): Order | undefined {
    return this.getOrders().find((o) => o.id === orderId || o.orderNumber === orderId);
  }

  private generateNextOrderNumber(): string {
    const seq = safeGetItem<number>(STORAGE_KEYS.ORDER_SEQUENCE, 105) + 1;
    safeSetItem(STORAGE_KEYS.ORDER_SEQUENCE, seq);
    const now = new Date();
    const year = now.getFullYear();
    const padded = String(seq).padStart(6, '0');
    return `CAF-${year}-${padded}`;
  }

  /**
   * ATOMIC ORDER COMPLETION TRANSACTION
   * 1. Validates cart & stock
   * 2. Deducts inventory from all products
   * 3. Creates inventory transaction logs
   * 4. Updates customer order statistics & lifetime spend
   * 5. Saves completed order with unique invoice number
   * 6. Appends audit log
   */
  public completeOrderTransaction(
    payload: {
      items?: CartItem[];
      cartItems?: CartItem[];
      orderType: OrderType;
      tableNumber?: string;
      subtotal: number;
      discountType: 'PERCENT' | 'FIXED';
      discountValue: number;
      discountAmount: number;
      discountReason?: string;
      taxRate?: number;
      taxAmount?: number;
      cgstAmount?: number;
      sgstAmount?: number;
      grandTotal: number;
      paymentMethod: PaymentMethod;
      paymentDetails: PaymentDetails;
      customer?: {
        id?: string;
        name: string;
        phone: string;
        email?: string;
      };
      staff?: {
        id: string;
        name: string;
        role: User['role'];
      };
      notes?: string;
      heldOrderIdToClear?: string;
    },
    staffParam?: User,
    settingsParam?: CafeSettings
  ): Order {
    const rawItems = payload.items || payload.cartItems || [];
    if (rawItems.length === 0) {
      throw new Error('Cart cannot be empty for checkout');
    }

    const settings = settingsParam || this.getSettings();
    const currentUser = staffParam || this.getActiveUserFallback();
    const staff = payload.staff || {
      id: currentUser.id,
      name: currentUser.name,
      role: currentUser.role,
    };

    const products = this.getProducts();
    const inventoryTxns = this.getInventoryTransactions();
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0];
    const timestamp = now.getTime();
    const orderNumber = this.generateNextOrderNumber();

    // 1. Check stock & deduct
    for (const item of rawItems) {
      const prod = products.find((p) => p.id === item.product.id);
      if (prod) {
        if (!settings.allowNegativeStock && prod.stock < item.quantity) {
          throw new Error(`Insufficient stock for "${prod.name}". Available: ${prod.stock}, Requested: ${item.quantity}`);
        }
        const previousStock = prod.stock;
        prod.stock = Math.max(0, prod.stock - item.quantity);

        inventoryTxns.unshift({
          id: `itx_${timestamp}_${Math.random().toString(36).substring(2, 6)}`,
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku,
          type: 'SALE',
          quantityChange: -item.quantity,
          previousStock,
          newStock: prod.stock,
          date: dateStr,
          time: timeStr,
          timestamp,
          reason: `Sold on Order ${orderNumber}`,
          staffName: staff.name,
          orderNumber,
        });
      }
    }

    // 2. Persist updated products & inventory txns
    safeSetItem(STORAGE_KEYS.PRODUCTS, products);
    safeSetItem(STORAGE_KEYS.INVENTORY_TXNS, inventoryTxns);

    // 3. Customer update
    let customerRef = payload.customer;
    if (customerRef && customerRef.phone && customerRef.phone !== '9999999999') {
      const savedCust = this.saveCustomer({
        id: customerRef.id || `cust_${Date.now()}`,
        name: customerRef.name || 'Valued Customer',
        phone: customerRef.phone,
        email: customerRef.email,
        totalOrders: 1,
        totalSpent: payload.grandTotal,
        lastOrderDate: dateStr,
        createdAt: dateStr,
      });
      // update lifetime stats if existed
      const allCusts = this.getCustomers();
      const existing = allCusts.find((c) => c.id === savedCust.id);
      if (existing) {
        existing.totalOrders = (existing.totalOrders || 0) + 1;
        existing.totalSpent = Number(((existing.totalSpent || 0) + payload.grandTotal).toFixed(2));
        existing.lastOrderDate = dateStr;
        safeSetItem(STORAGE_KEYS.CUSTOMERS, allCusts);
      }
      customerRef = {
        id: savedCust.id,
        name: savedCust.name,
        phone: savedCust.phone,
      };
    }

    const calculatedTaxRate = payload.taxRate ?? settings.taxRate;
    const calculatedTaxAmount = payload.taxAmount ?? Number((((payload.subtotal - payload.discountAmount) * calculatedTaxRate) / 100).toFixed(2));
    const cgst = payload.cgstAmount ?? Number((calculatedTaxAmount / 2).toFixed(2));
    const sgst = payload.sgstAmount ?? Number((calculatedTaxAmount / 2).toFixed(2));

    // 4. Construct Order record
    const newOrder: Order = {
      id: `ord_${timestamp}`,
      orderNumber,
      date: dateStr,
      time: timeStr,
      timestamp,
      orderType: payload.orderType,
      tableNumber: payload.tableNumber,
      items: rawItems.map((ci) => ({
        productId: ci.product.id,
        productName: ci.product.name,
        sku: ci.product.sku,
        categoryName: ci.product.categoryId,
        quantity: ci.quantity,
        unitPrice: ci.unitPrice,
        totalPrice: Number((ci.unitPrice * ci.quantity).toFixed(2)),
        costPrice: ci.product.costPrice,
        note: ci.note,
        isVeg: ci.product.isVeg,
      })),
      itemCount: rawItems.reduce((acc, ci) => acc + ci.quantity, 0),
      subtotal: payload.subtotal,
      discountType: payload.discountType,
      discountValue: payload.discountValue,
      discountAmount: payload.discountAmount,
      discountReason: payload.discountReason,
      taxType: settings.isTaxInclusive ? 'INCLUSIVE' : 'EXCLUSIVE',
      taxRate: calculatedTaxRate,
      taxAmount: calculatedTaxAmount,
      cgstAmount: cgst,
      sgstAmount: sgst,
      grandTotal: payload.grandTotal,
      paymentMethod: payload.paymentMethod,
      paymentDetails: payload.paymentDetails,
      customer: customerRef,
      staff,
      status: 'COMPLETED',
      notes: payload.notes,
    };

    // 5. Append to orders list
    const orders = this.getOrders();
    orders.unshift(newOrder);
    safeSetItem(STORAGE_KEYS.ORDERS, orders);

    // 6. Clear held order if it was retrieved
    if (payload.heldOrderIdToClear) {
      this.deleteHeldOrder(payload.heldOrderIdToClear);
    }

    // 7. Audit log
    this.addAuditLog({
      userId: staff.id,
      userName: staff.name,
      userRole: staff.role,
      action: 'ORDER_COMPLETED',
      entity: 'ORDER',
      entityId: orderNumber,
      details: `Completed ${newOrder.orderType} order ${orderNumber} (${newOrder.itemCount} items) for ${settings.currencySymbol}${(Number(newOrder.grandTotal) || 0).toFixed(2)} via ${newOrder.paymentMethod}`,
    });

    return newOrder;
  }

  /**
   * CANCEL / REFUND ORDER WITH AUTOMATIC STOCK RESTORATION
   */
  public cancelOrRefundOrder(
    orderId: string,
    action: 'CANCEL' | 'REFUND',
    reason: string,
    authorizedStaff: User
  ): Order {
    const orders = this.getOrders();
    const order = orders.find((o) => o.id === orderId || o.orderNumber === orderId);
    if (!order) throw new Error('Order not found');

    if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
      throw new Error(`Order is already ${order.status.toLowerCase()}`);
    }

    const previousStatus = order.status;
    order.status = action === 'CANCEL' ? 'CANCELLED' : 'REFUNDED';
    order.cancelReason = reason;
    order.cancelledBy = authorizedStaff.name;
    const now = new Date();
    order.cancelledAt = now.toISOString();
    if (action === 'REFUND') {
      order.refundedAmount = order.grandTotal;
    }

    // Restore stock for all items
    const products = this.getProducts();
    const inventoryTxns = this.getInventoryTransactions();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0];
    const timestamp = now.getTime();

    for (const item of order.items) {
      const prod = products.find((p) => p.id === item.productId);
      if (prod) {
        const previousStock = prod.stock;
        prod.stock = prod.stock + item.quantity;

        inventoryTxns.unshift({
          id: `itx_${timestamp}_${Math.random().toString(36).substring(2, 6)}`,
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku,
          type: 'RETURN_RESTORE',
          quantityChange: item.quantity,
          previousStock,
          newStock: prod.stock,
          date: dateStr,
          time: timeStr,
          timestamp,
          reason: `Stock restored from ${action} of order ${order.orderNumber} (${reason})`,
          staffName: authorizedStaff.name,
          orderNumber: order.orderNumber,
        });
      }
    }

    safeSetItem(STORAGE_KEYS.PRODUCTS, products);
    safeSetItem(STORAGE_KEYS.INVENTORY_TXNS, inventoryTxns);
    safeSetItem(STORAGE_KEYS.ORDERS, orders);

    this.addAuditLog({
      userId: authorizedStaff.id,
      userName: authorizedStaff.name,
      userRole: authorizedStaff.role,
      action: action === 'CANCEL' ? 'ORDER_CANCELLED' : 'ORDER_REFUNDED',
      entity: 'ORDER',
      entityId: order.orderNumber,
      details: `${action === 'CANCEL' ? 'Cancelled' : 'Refunded'} order ${order.orderNumber} for ₹${(Number(order.grandTotal) || 0).toFixed(2)}. Restored stock for ${order.items.length} items. Reason: ${reason}`,
    });

    return order;
  }

  /**
   * PERMANENTLY DELETE AN ORDER FROM LOCAL STORAGE
   */
  public deleteOrder(orderId: string): boolean {
    const orders = this.getOrders();
    const filtered = orders.filter((o) => o.id !== orderId && o.orderNumber !== orderId);
    if (filtered.length !== orders.length) {
      safeSetItem(STORAGE_KEYS.ORDERS, filtered);
      return true;
    }
    return false;
  }

  /**
   * PERMANENTLY BULK DELETE ORDERS FROM LOCAL STORAGE
   */
  public deleteOrders(orderIds: string[]): number {
    const idSet = new Set(orderIds);
    const orders = this.getOrders();
    const filtered = orders.filter((o) => !idSet.has(o.id) && !idSet.has(o.orderNumber));
    const count = orders.length - filtered.length;
    if (count > 0) {
      safeSetItem(STORAGE_KEYS.ORDERS, filtered);
    }
    return count;
  }

  // ====================== HELD ORDERS ======================
  public getHeldOrders(): HeldOrder[] {
    return safeGetItem<HeldOrder[]>(STORAGE_KEYS.HELD_ORDERS, []);
  }

  public holdOrder(
    payload: {
      cartItems?: CartItem[];
      items?: CartItem[];
      orderType: OrderType;
      tableNumber?: string;
      customer?: { id?: string; name: string; phone: string } | null;
      notes?: string;
      discountType?: 'PERCENT' | 'FIXED';
      discountValue?: number;
      discountAmount?: number;
      discountReason?: string;
      taxAmount?: number;
      grandTotal?: number;
      subtotal?: number;
      source?: 'STAFF' | 'CUSTOMER_QR';
    },
    staffUser?: User
  ): HeldOrder {
    const heldOrders = this.getHeldOrders();
    const items = payload.items || payload.cartItems || [];
    const now = new Date();

    // Check if an open ticket already exists for the same table (for DINE_IN orders)
    if (payload.tableNumber && payload.orderType === 'DINE_IN') {
      const cleanTbl = payload.tableNumber.trim().toUpperCase();
      const existingIndex = heldOrders.findIndex(
        (h) => h.tableNumber && h.tableNumber.trim().toUpperCase() === cleanTbl && h.orderType === 'DINE_IN'
      );

      if (existingIndex >= 0) {
        const existing = { ...heldOrders[existingIndex] };
        const mergedItems = [...(existing.cartItems || existing.items || [])];

        for (const newItem of items) {
          const foundIdx = mergedItems.findIndex(
            (mi) => mi.product.id === newItem.product.id && (mi.note || '') === (newItem.note || '')
          );
          if (foundIdx >= 0) {
            mergedItems[foundIdx] = {
              ...mergedItems[foundIdx],
              quantity: mergedItems[foundIdx].quantity + newItem.quantity,
            };
          } else {
            mergedItems.push({ ...newItem });
          }
        }

        const newSubtotal = mergedItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
        const settings = this.getSettings();
        const taxRate = Number(settings.taxRate ?? 5);
        const newTaxAmount = Number(((newSubtotal * taxRate) / 100).toFixed(2));
        const discountAmt = existing.discountAmount || 0;
        const newGrandTotal = Number(Math.max(0, newSubtotal + newTaxAmount - discountAmt).toFixed(2));

        const noteParts = [existing.notes, payload.notes].filter(Boolean);
        const combinedNotes = noteParts.filter((n, i) => noteParts.indexOf(n) === i).join(' | ');

        const existingKots = existing.kots && existing.kots.length > 0
          ? existing.kots
          : [{
              id: `kot_${existing.createdAt || Date.now()}`,
              kotNumber: 1,
              createdAt: existing.createdAt || Date.now(),
              time: existing.heldAt || `${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
              items: existing.cartItems || existing.items || [],
              kitchenStatus: existing.kitchenStatus || 'PREPARING',
              notes: existing.notes,
            }];

        const nextKotNumber = existingKots.length + 1;
        const newKotRound = {
          id: `kot_${Date.now()}_${nextKotNumber}`,
          kotNumber: nextKotNumber,
          createdAt: Date.now(),
          time: `${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          items: items,
          kitchenStatus: 'PREPARING' as const,
          notes: payload.notes,
        };

        const updatedHeld: HeldOrder = {
          ...existing,
          cartItems: mergedItems,
          items: mergedItems,
          subtotal: newSubtotal,
          grandTotal: newGrandTotal,
          notes: combinedNotes,
          kitchenStatus: 'PREPARING',
          heldAt: `${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          kots: [...existingKots, newKotRound],
        };

        heldOrders[existingIndex] = updatedHeld;
        safeSetItem(STORAGE_KEYS.HELD_ORDERS, heldOrders);

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('pos_order_held', { detail: updatedHeld }));
        }

        return updatedHeld;
      }
    }

    const subtotal = payload.subtotal ?? items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const discountVal = payload.discountValue || 0;
    const discountType = payload.discountType || 'PERCENT';
    const discountAmt =
      payload.discountAmount ??
      (discountType === 'PERCENT' ? (subtotal * discountVal) / 100 : Math.min(subtotal, discountVal));
    const grandTotal = payload.grandTotal ?? Math.max(0, subtotal - discountAmt);

    const initialKotRound = {
      id: `kot_${Date.now()}_1`,
      kotNumber: 1,
      createdAt: Date.now(),
      time: `${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      items: items,
      kitchenStatus: 'PREPARING' as const,
      notes: payload.notes,
    };

    const newHeld: HeldOrder = {
      id: `hold_${Date.now()}`,
      holdNumber: heldOrders.length + 1,
      createdAt: Date.now(),
      heldAt: `${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      orderType: payload.orderType,
      tableNumber: payload.tableNumber,
      cartItems: items,
      items: items,
      customer: payload.customer || undefined,
      customerId: payload.customer?.id,
      customerName: payload.customer?.name || (payload.tableNumber ? `Table ${payload.tableNumber} Guest` : 'Walk-in'),
      notes: payload.notes,
      discountType: discountType,
      discountValue: discountVal,
      discountAmount: discountAmt,
      discountReason: payload.discountReason,
      subtotal: subtotal,
      grandTotal: grandTotal,
      source: payload.source || 'STAFF',
      kitchenStatus: 'PREPARING',
      kitchenStartedAt: Date.now(),
      completedItemIndices: [],
      kots: [initialKotRound],
    };
    const deletedIds = safeGetItem<string[]>(STORAGE_KEYS.DELETED_HELD_ORDER_IDS, []);
    if (deletedIds.includes(newHeld.id)) {
      safeSetItem(
        STORAGE_KEYS.DELETED_HELD_ORDER_IDS,
        deletedIds.filter((id) => id !== newHeld.id)
      );
    }

    heldOrders.unshift(newHeld);
    safeSetItem(STORAGE_KEYS.HELD_ORDERS, heldOrders);

    const currentUser = staffUser || this.getActiveUserFallback();
    this.addAuditLog({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action: 'HELD_ORDER',
      entity: 'ORDER',
      details: payload.source === 'CUSTOMER_QR'
        ? `Table QR Order: Table ${payload.tableNumber || 'Dine-In'} submitted hold #${newHeld.holdNumber} (${items.length} items, grand total ₹${(Number(grandTotal) || 0).toFixed(2)}) for staff review`
        : `Held temporary cart #${newHeld.holdNumber} (${items.length} items, grand total ₹${(Number(grandTotal) || 0).toFixed(2)})`,
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pos_order_held', { detail: newHeld }));
    }

    return newHeld;
  }

  public saveHeldOrder(
    payload: {
      cartItems?: CartItem[];
      items?: CartItem[];
      orderType: OrderType;
      tableNumber?: string;
      customer?: { id?: string; name: string; phone: string } | null;
      notes?: string;
      discountType?: 'PERCENT' | 'FIXED';
      discountValue?: number;
      discountAmount?: number;
      discountReason?: string;
      taxAmount?: number;
      grandTotal?: number;
      subtotal?: number;
      source?: 'STAFF' | 'CUSTOMER_QR';
    },
    staffUser?: User
  ): HeldOrder {
    return this.holdOrder(payload, staffUser);
  }

  public getDeletedHeldOrderIds(): string[] {
    return safeGetItem<string[]>(STORAGE_KEYS.DELETED_HELD_ORDER_IDS, []);
  }

  public deleteHeldOrder(heldId: string): void {
    const deletedIds = this.getDeletedHeldOrderIds();
    if (!deletedIds.includes(heldId)) {
      deletedIds.push(heldId);
      if (deletedIds.length > 500) deletedIds.shift();
      safeSetItem(STORAGE_KEYS.DELETED_HELD_ORDER_IDS, deletedIds);
    }
    const heldOrders = this.getHeldOrders().filter((h) => h.id !== heldId);
    safeSetItem(STORAGE_KEYS.HELD_ORDERS, heldOrders);
  }

  public updateHeldOrderKitchenStatus(
    heldId: string,
    status: 'PREPARING' | 'READY' | 'SERVED',
    kotId?: string
  ): HeldOrder | null {
    const heldOrders = this.getHeldOrders();
    const index = heldOrders.findIndex((h) => h.id === heldId);
    if (index === -1) return null;

    const current = heldOrders[index];
    const now = Date.now();

    let updatedKots = current.kots;
    if (kotId && current.kots && current.kots.length > 0) {
      updatedKots = current.kots.map((k) => (k.id === kotId ? { ...k, kitchenStatus: status } : k));
    }

    let computedOverallStatus: 'PREPARING' | 'READY' | 'SERVED' = status;
    if (updatedKots && updatedKots.length > 0) {
      const allServed = updatedKots.every((k) => k.kitchenStatus === 'SERVED');
      const allReadyOrServed = updatedKots.every((k) => k.kitchenStatus === 'READY' || k.kitchenStatus === 'SERVED');
      if (allServed) computedOverallStatus = 'SERVED';
      else if (allReadyOrServed) computedOverallStatus = 'READY';
      else computedOverallStatus = 'PREPARING';
    }

    const updated: HeldOrder = {
      ...current,
      kitchenStatus: computedOverallStatus,
      kitchenStartedAt: current.kitchenStartedAt || (status === 'PREPARING' ? now : current.createdAt || now),
      kitchenReadyAt: status === 'READY' ? now : current.kitchenReadyAt,
      kitchenServedAt: status === 'SERVED' ? now : current.kitchenServedAt,
      kots: updatedKots,
    };

    heldOrders[index] = updated;
    safeSetItem(STORAGE_KEYS.HELD_ORDERS, heldOrders);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pos_held_order_updated', { detail: updated }));
    }

    return updated;
  }

  public toggleHeldOrderItemCompletion(heldId: string, itemIndex: number, kotId?: string): HeldOrder | null {
    const heldOrders = this.getHeldOrders();
    const index = heldOrders.findIndex((h) => h.id === heldId);
    if (index === -1) return null;

    const current = heldOrders[index];
    let updatedKots = current.kots;

    if (kotId && current.kots && current.kots.length > 0) {
      updatedKots = current.kots.map((k) => {
        if (k.id === kotId) {
          const currentCompleted = k.completedItemIndices || [];
          const newCompleted = currentCompleted.includes(itemIndex)
            ? currentCompleted.filter((i) => i !== itemIndex)
            : [...currentCompleted, itemIndex];
          return { ...k, completedItemIndices: newCompleted };
        }
        return k;
      });
    }

    const currentCompleted = current.completedItemIndices || [];
    const newCompleted = currentCompleted.includes(itemIndex)
      ? currentCompleted.filter((i) => i !== itemIndex)
      : [...currentCompleted, itemIndex];

    const updated: HeldOrder = {
      ...current,
      completedItemIndices: newCompleted,
      kots: updatedKots,
    };

    heldOrders[index] = updated;
    safeSetItem(STORAGE_KEYS.HELD_ORDERS, heldOrders);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pos_held_order_updated', { detail: updated }));
    }

    return updated;
  }

  public mergeServerOrder(serverOrder: Order): void {
    const orders = this.getOrders();
    const existingIndex = orders.findIndex((o) => o.id === serverOrder.id || o.orderNumber === serverOrder.orderNumber);
    if (existingIndex >= 0) {
      orders[existingIndex] = { ...orders[existingIndex], ...serverOrder };
    } else {
      orders.unshift(serverOrder);
    }
    safeSetItem(STORAGE_KEYS.ORDERS, orders);
  }

  public mergeServerHeldOrder(serverHeld: HeldOrder): void {
    const heldOrders = this.getHeldOrders();
    const existingIndex = heldOrders.findIndex(
      (h) =>
        h.id === serverHeld.id ||
        (h.tableNumber &&
          serverHeld.tableNumber &&
          h.tableNumber.trim().toUpperCase() === serverHeld.tableNumber.trim().toUpperCase() &&
          h.orderType === 'DINE_IN' &&
          serverHeld.orderType === 'DINE_IN')
    );

    if (existingIndex >= 0) {
      const existing = heldOrders[existingIndex];
      if (existing.id !== serverHeld.id) {
        const mergedItems = [...(existing.cartItems || existing.items || [])];
        for (const item of serverHeld.cartItems || serverHeld.items || []) {
          const idx = mergedItems.findIndex(
            (mi) => mi.product.id === item.product.id && (mi.note || '') === (item.note || '')
          );
          if (idx >= 0) {
            mergedItems[idx] = { ...mergedItems[idx], quantity: mergedItems[idx].quantity + item.quantity };
          } else {
            mergedItems.push({ ...item });
          }
        }
        const newSubtotal = mergedItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
        const settings = this.getSettings();
        const taxRate = Number(settings.taxRate ?? 5);
        const newTaxAmount = Number(((newSubtotal * taxRate) / 100).toFixed(2));
        const newGrandTotal = Number((newSubtotal + newTaxAmount).toFixed(2));
        const combinedNotes = [existing.notes, serverHeld.notes]
          .filter(Boolean)
          .filter((n, i, arr) => arr.indexOf(n) === i)
          .join(' | ');

        heldOrders[existingIndex] = {
          ...existing,
          cartItems: mergedItems,
          items: mergedItems,
          subtotal: newSubtotal,
          grandTotal: newGrandTotal,
          kitchenStatus: 'PREPARING',
          notes: combinedNotes,
        };
      } else {
        heldOrders[existingIndex] = { ...heldOrders[existingIndex], ...serverHeld };
      }
    } else {
      heldOrders.unshift(serverHeld);
    }
    safeSetItem(STORAGE_KEYS.HELD_ORDERS, heldOrders);
  }

  public syncFromServer(serverOrders: Order[], serverHeldOrders: HeldOrder[]): void {
    if (Array.isArray(serverOrders) && serverOrders.length > 0) {
      safeSetItem(STORAGE_KEYS.ORDERS, serverOrders);
    }
    if (Array.isArray(serverHeldOrders)) {
      const deletedIds = new Set(this.getDeletedHeldOrderIds());
      const localHeld = this.getHeldOrders();

      const validServerHeld = serverHeldOrders.filter((h) => !deletedIds.has(h.id));
      
      // Group server held orders by table number for Dine-In orders
      const mergedTableMap = new Map<string, HeldOrder>();
      for (const sh of validServerHeld) {
        const key = sh.tableNumber && sh.orderType === 'DINE_IN' ? `TBL_${sh.tableNumber.trim().toUpperCase()}` : sh.id;
        if (!mergedTableMap.has(key)) {
          mergedTableMap.set(key, { ...sh });
        } else {
          const existing = mergedTableMap.get(key)!;
          const mergedItems = [...(existing.cartItems || existing.items || [])];
          for (const item of sh.cartItems || sh.items || []) {
            const idx = mergedItems.findIndex(
              (mi) => mi.product.id === item.product.id && (mi.note || '') === (item.note || '')
            );
            if (idx >= 0) {
              mergedItems[idx] = { ...mergedItems[idx], quantity: mergedItems[idx].quantity + item.quantity };
            } else {
              mergedItems.push({ ...item });
            }
          }
          const newSubtotal = mergedItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
          const settings = this.getSettings();
          const taxRate = Number(settings.taxRate ?? 5);
          const newTaxAmount = Number(((newSubtotal * taxRate) / 100).toFixed(2));
          const newGrandTotal = Number((newSubtotal + newTaxAmount).toFixed(2));
          const combinedNotes = [existing.notes, sh.notes]
            .filter(Boolean)
            .filter((n, i, arr) => arr.indexOf(n) === i)
            .join(' | ');

          mergedTableMap.set(key, {
            ...existing,
            cartItems: mergedItems,
            items: mergedItems,
            subtotal: newSubtotal,
            grandTotal: newGrandTotal,
            kitchenStatus: 'PREPARING',
            notes: combinedNotes,
          });
        }
      }

      const reconciledList = Array.from(mergedTableMap.values());
      const validServerIds = new Set(reconciledList.map((h) => h.id));
      const unsyncedLocal = localHeld.filter((h) => !validServerIds.has(h.id) && !deletedIds.has(h.id));

      const merged = [...unsyncedLocal, ...reconciledList];
      merged.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      safeSetItem(STORAGE_KEYS.HELD_ORDERS, merged);
    }
  }

  // ====================== SETTINGS ======================
  public getSettings(): CafeSettings {
    return safeGetItem<CafeSettings>(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS);
  }

  public updateSettings(settings: CafeSettings): void {
    safeSetItem(STORAGE_KEYS.SETTINGS, settings);
    posDb.saveSettings(settings).catch((err) => console.warn('Failed to save settings to DB:', err));
    const currentUser = this.getActiveUserFallback();
    this.addAuditLog({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action: 'SETTINGS_UPDATED',
      entity: 'SETTING',
      details: `Updated café settings (Name: ${settings.cafeName}, Tax: ${settings.taxRate}%, Printer: ${settings.receiptWidth})`,
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pos_menu_updated'));
    }
  }

  // ====================== AUDIT LOGS ======================
  public getAuditLogs(): AuditLog[] {
    return safeGetItem<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS);
  }

  public addAuditLog(entry: Omit<AuditLog, 'id' | 'timestamp' | 'date' | 'time'>): void {
    const now = new Date();
    const log: AuditLog = {
      ...entry,
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: now.getTime(),
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().split(' ')[0],
    };
    const logs = this.getAuditLogs();
    logs.unshift(log);
    // Keep max 500 logs for performance
    if (logs.length > 500) logs.pop();
    safeSetItem(STORAGE_KEYS.AUDIT_LOGS, logs);
  }

  // ====================== BACKUP & EXPORT ======================
  public exportFullBackup(): string {
    const data = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      categories: this.getCategories(),
      products: this.getProducts(),
      users: this.getUsers(),
      customers: this.getCustomers(),
      settings: this.getSettings(),
      orders: this.getOrders(),
      inventoryTransactions: this.getInventoryTransactions(),
      auditLogs: this.getAuditLogs(),
    };
    return JSON.stringify(data, null, 2);
  }

  public restoreBackup(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (data.categories) safeSetItem(STORAGE_KEYS.CATEGORIES, data.categories);
      if (data.products) safeSetItem(STORAGE_KEYS.PRODUCTS, data.products);
      if (data.users) safeSetItem(STORAGE_KEYS.USERS, data.users);
      if (data.customers) safeSetItem(STORAGE_KEYS.CUSTOMERS, data.customers);
      if (data.settings) safeSetItem(STORAGE_KEYS.SETTINGS, data.settings);
      if (data.orders) safeSetItem(STORAGE_KEYS.ORDERS, data.orders);
      if (data.inventoryTransactions) safeSetItem(STORAGE_KEYS.INVENTORY_TXNS, data.inventoryTransactions);
      if (data.auditLogs) safeSetItem(STORAGE_KEYS.AUDIT_LOGS, data.auditLogs);
      return true;
    } catch (err) {
      console.error('Failed to restore backup', err);
      return false;
    }
  }

  public resetToFactoryDemo(): void {
    localStorage.clear();
    this.initializeIfEmpty();
  }
  public saveSettings(settings: CafeSettings): void {
    this.updateSettings(settings);
  }

  public importFullBackup(jsonString: string): boolean {
    return this.restoreBackup(jsonString);
  }

  public resetToFactorySeed(): void {
    this.resetToFactoryDemo();
  }

  public adjustProductStock(
    productId: string,
    quantityChange: number,
    type: 'PURCHASE' | 'DAMAGE' | 'ADJUSTMENT',
    reason: string,
    staffName: string
  ): Product {
    return this.adjustStock(productId, quantityChange, type, reason, staffName);
  }

  public getInventoryLogs(productId?: string): InventoryTransaction[] {
    const all = this.getInventoryTransactions();
    if (productId) {
      return all.filter((l) => l.productId === productId);
    }
    return all;
  }
}

export const posStorage = new PosStorageService();
