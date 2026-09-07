import { Order, CafeSettings } from '../types';

export class PosPrinterService {
  /**
   * Generates exact monospace thermal receipt text formatted for 32 columns (58mm) or 48 columns (80mm)
   */
  public generateMonospaceReceipt(order: Order, settings: CafeSettings): string {
    const width = settings.receiptWidth === '58mm' ? 32 : 48;
    const pad = (text: string, len: number, align: 'left' | 'right' | 'center' = 'left') => {
      text = text.toString();
      if (text.length >= len) return text.substring(0, len);
      const diff = len - text.length;
      if (align === 'right') return ' '.repeat(diff) + text;
      if (align === 'center') {
        const left = Math.floor(diff / 2);
        const right = diff - left;
        return ' '.repeat(left) + text + ' '.repeat(right);
      }
      return text + ' '.repeat(diff);
    };

    const separator = '-'.repeat(width);
    const doubleSep = '='.repeat(width);

    const lines: string[] = [];

    // Header
    lines.push(pad(settings.cafeName.toUpperCase(), width, 'center'));
    if (settings.tagline) {
      lines.push(pad(settings.tagline, width, 'center'));
    }
    if (settings.address) {
      const addrLines = this.wrapText(settings.address, width);
      addrLines.forEach((l) => lines.push(pad(l, width, 'center')));
    }
    if (settings.phone) {
      lines.push(pad(`Phone: ${settings.phone}`, width, 'center'));
    }
    if (settings.gstNumber) {
      lines.push(pad(`GSTIN: ${settings.gstNumber}`, width, 'center'));
    }
    if (settings.fssaiNumber) {
      lines.push(pad(`FSSAI: ${settings.fssaiNumber}`, width, 'center'));
    }

    lines.push(separator);
    lines.push(pad(settings.receiptHeader || 'TAX INVOICE / CASH BILL', width, 'center'));
    lines.push(separator);

    // Meta details
    lines.push(`Order No : ${order.orderNumber}`);
    lines.push(`Date     : ${order.date}  ${order.time}`);
    lines.push(`Type     : ${order.orderType}${order.tableNumber ? ' (' + order.tableNumber + ')' : ''}`);

    lines.push(separator);

    // Items table header
    if (width === 32) {
      // 32 Col layout: ITEM (16) QTY(4) AMT(10) + spaces
      lines.push(pad('ITEM', 16, 'left') + pad('QTY', 4, 'center') + pad('AMT', 12, 'right'));
    } else {
      // 48 Col layout: ITEM (24) PRICE(8) QTY(5) TOTAL(11)
      lines.push(pad('ITEM', 24, 'left') + pad('PRICE', 8, 'right') + pad('QTY', 5, 'center') + pad('TOTAL', 11, 'right'));
    }
    lines.push(separator);

    // Items rows
    for (const item of order.items || []) {
      const sym = settings.currencySymbol;
      const unitPrice = Number(item.unitPrice) || 0;
      const quantity = Number(item.quantity) || 0;
      const totalPrice = Number(item.totalPrice ?? (unitPrice * quantity)) || 0;

      if (width === 32) {
        const nameLines = this.wrapText(item.productName || 'Item', 16);
        const firstLineName = nameLines[0] || '';
        const qtyStr = quantity.toString();
        const amtStr = `${sym}${totalPrice.toFixed(2)}`;
        lines.push(pad(firstLineName, 16, 'left') + pad(qtyStr, 4, 'center') + pad(amtStr, 12, 'right'));
        for (let i = 1; i < nameLines.length; i++) {
          lines.push(pad(nameLines[i], 16, 'left'));
        }
      } else {
        const nameLines = this.wrapText(item.productName || 'Item', 24);
        const firstLineName = nameLines[0] || '';
        const priceStr = `${sym}${unitPrice.toFixed(2)}`;
        const qtyStr = quantity.toString();
        const amtStr = `${sym}${totalPrice.toFixed(2)}`;
        lines.push(pad(firstLineName, 24, 'left') + pad(priceStr, 8, 'right') + pad(qtyStr, 5, 'center') + pad(amtStr, 11, 'right'));
        for (let i = 1; i < nameLines.length; i++) {
          lines.push(pad(nameLines[i], 24, 'left'));
        }
      }
      if (item.note) {
        lines.push(`  * Note: ${item.note}`);
      }
    }

    lines.push(separator);

    // Totals
    const sym = settings.currencySymbol;
    const addTotalRow = (label: string, value: string) => {
      const remaining = width - label.length;
      lines.push(label + pad(value, remaining, 'right'));
    };

    const subtotal = Number(order.subtotal) || 0;
    const discountAmount = Number(order.discountAmount) || 0;
    const taxAmount = Number(order.taxAmount) || 0;
    const grandTotal = Number(order.grandTotal) || 0;
    const taxRate = Number(order.taxRate) || 0;
    const cgstAmount = Number(order.cgstAmount) || 0;
    const sgstAmount = Number(order.sgstAmount) || 0;

    addTotalRow('Subtotal', `${sym}${subtotal.toFixed(2)}`);

    if (discountAmount > 0) {
      const discLabel = `Discount (${order.discountType === 'PERCENT' ? (order.discountValue || 0) + '%' : 'Flat'})`;
      addTotalRow(discLabel, `-${sym}${discountAmount.toFixed(2)}`);
    }

    if (taxAmount > 0) {
      if (cgstAmount && sgstAmount) {
        addTotalRow(`CGST (${(taxRate / 2).toFixed(1)}%)`, `${sym}${cgstAmount.toFixed(2)}`);
        addTotalRow(`SGST (${(taxRate / 2).toFixed(1)}%)`, `${sym}${sgstAmount.toFixed(2)}`);
      } else {
        addTotalRow(`Tax (${taxRate}%)`, `${sym}${taxAmount.toFixed(2)}`);
      }
    }

    lines.push(doubleSep);
    addTotalRow('GRAND TOTAL', `${sym}${grandTotal.toFixed(2)}`);
    lines.push(doubleSep);

    // Payment details
    lines.push(`Payment Method : ${order.paymentMethod}`);
    if (order.paymentMethod === 'CASH' && order.paymentDetails?.amountReceived != null) {
      const amtReceived = Number(order.paymentDetails.amountReceived) || 0;
      addTotalRow('Cash Received', `${sym}${amtReceived.toFixed(2)}`);
      if (order.paymentDetails.changeGiven !== undefined) {
        const changeGiven = Number(order.paymentDetails.changeGiven) || 0;
        addTotalRow('Change Return', `${sym}${changeGiven.toFixed(2)}`);
      }
    } else if (order.paymentMethod === 'UPI' && order.paymentDetails?.upiReference) {
      lines.push(`UPI Ref ID     : ${order.paymentDetails.upiReference}`);
    } else if (order.paymentMethod === 'CARD' && order.paymentDetails?.cardLast4) {
      lines.push(`Card Ending    : **** **** **** ${order.paymentDetails.cardLast4}`);
    }

    lines.push(separator);

    // Footer & Terms
    if (settings.receiptFooter) {
      settings.receiptFooter.split('\n').forEach((f) => {
        lines.push(pad(f, width, 'center'));
      });
    }

    if (settings.receiptTerms) {
      lines.push('');
      this.wrapText(settings.receiptTerms, width).forEach((t) => {
        lines.push(pad(t, width, 'center'));
      });
    }

    lines.push(pad('*** VISIT AGAIN ***', width, 'center'));
    lines.push('\n\n'); // Paper feed margin

    return lines.join('\n');
  }

  private wrapText(text: string, maxLen: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if ((currentLine + ' ' + word).trim().length <= maxLen) {
        currentLine = (currentLine + ' ' + word).trim();
      } else {
        if (currentLine) lines.push(currentLine);
        if (word.length > maxLen) {
          lines.push(word.substring(0, maxLen));
          currentLine = word.substring(maxLen);
        } else {
          currentLine = word;
        }
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines.length > 0 ? lines : [''];
  }

  /**
   * Generates clean, printer-ready thermal HTML for iframe or popup printing
   */
  public generateReceiptHtml(order: Order, settings: CafeSettings): string {
    const is58mm = settings.receiptWidth === '58mm';
    const paperWidth = is58mm ? '58mm' : '80mm';
    const contentWidth = is58mm ? '52mm' : '72mm';
    const sym = settings.currencySymbol || '₹';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt - ${order.orderNumber}</title>
  <style>
    @page {
      margin: 0;
      size: ${paperWidth} auto;
    }
    @media print {
      body {
        margin: 0;
        padding: 4mm;
        width: 100%;
        max-width: ${paperWidth};
      }
    }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: ${is58mm ? '11px' : '12px'};
      line-height: 1.25;
      color: #000000;
      background: #ffffff;
      margin: 0 auto;
      padding: 8px;
      max-width: ${contentWidth};
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .font-bold { font-weight: bold; }
    .divider { border-top: 1px dashed #000000; margin: 6px 0; }
    .double-divider { border-top: 2px solid #000000; margin: 6px 0; }
    .row-meta { display: flex; justify-content: space-between; margin-bottom: 2px; }
    .logo-img { max-height: 64px; max-width: 160px; object-fit: contain; margin: 0 auto 6px auto; display: block; filter: grayscale(100%) contrast(200%); }
    .barcode {
      margin: 6px auto;
      height: 24px;
      width: 140px;
      background: #000;
      display: flex;
      justify-content: space-around;
      padding: 0 4px;
    }
    .bar { width: 2px; height: 100%; background: #fff; }
    .bar-thin { width: 1px; height: 100%; background: #fff; }
    .bar-thick { width: 3px; height: 100%; background: #fff; }
  </style>
</head>
<body>
  ${settings.logoUrl ? `<img src="${settings.logoUrl}" class="logo-img" alt="Logo" onerror="this.style.display='none'"/>` : ''}
  <div class="text-center font-bold" style="font-size: ${is58mm ? '13px' : '15px'}; text-transform: uppercase;">
    ${settings.cafeName || 'ARTISAN CAFÉ'}
  </div>
  ${settings.tagline ? `<div class="text-center" style="font-size: 10px;">${settings.tagline}</div>` : ''}
  ${settings.address ? `<div class="text-center" style="font-size: 10px;">${settings.address}</div>` : ''}
  ${settings.phone ? `<div class="text-center" style="font-size: 10px;">Ph: ${settings.phone}</div>` : ''}
  ${settings.gstNumber ? `<div class="text-center font-bold" style="font-size: 10px;">GSTIN: ${settings.gstNumber}</div>` : ''}
  
  <div class="divider"></div>
  <div class="text-center font-bold" style="font-size: 11px;">
    ${settings.receiptHeader || 'TAX INVOICE / CASH RECEIPT'}
  </div>
  <div class="divider"></div>

  <div class="row-meta"><span>Order No:</span><span class="font-bold">${order.orderNumber}</span></div>
  <div class="row-meta"><span>Date & Time:</span><span>${order.date} ${order.time}</span></div>
  <div class="row-meta"><span>Type:</span><span class="font-bold">${order.orderType}${order.tableNumber ? ' (' + order.tableNumber + ')' : ''}</span></div>

  <div class="divider"></div>
  <div class="row-meta font-bold" style="border-bottom: 1px solid #000; padding-bottom: 2px;">
    <span style="flex: 2;">ITEM</span>
    <span style="width: 32px; text-align: center;">QTY</span>
    <span style="flex: 1; text-align: right;">AMT</span>
  </div>

  ${(order.items || []).map(it => `
    <div style="margin-top: 3px;">
      <div class="row-meta">
        <span style="flex: 2;">${it.productName}</span>
        <span style="width: 32px; text-align: center; font-weight: bold;">${it.quantity}</span>
        <span style="flex: 1; text-align: right; font-weight: bold;">${sym}${(Number(it.totalPrice ?? (it.unitPrice * it.quantity)) || 0).toFixed(2)}</span>
      </div>
      ${it.note ? `<div style="font-size: 9px; font-style: italic; margin-left: 6px;">* ${it.note}</div>` : ''}
    </div>
  `).join('')}

  <div class="divider"></div>
  <div class="row-meta"><span>Subtotal:</span><span>${sym}${(Number(order.subtotal) || 0).toFixed(2)}</span></div>
  ${(order.discountAmount || 0) > 0 ? `
    <div class="row-meta"><span>Discount (${order.discountType === 'PERCENT' ? (order.discountValue || 0) + '%' : 'Flat'}):</span><span>-${sym}${(Number(order.discountAmount) || 0).toFixed(2)}</span></div>
  ` : ''}
  ${(order.taxAmount || 0) > 0 ? `
    ${order.cgstAmount && order.sgstAmount ? `
      <div class="row-meta"><span>CGST (${((order.taxRate || 0) / 2).toFixed(1)}%):</span><span>+${sym}${(Number(order.cgstAmount) || 0).toFixed(2)}</span></div>
      <div class="row-meta"><span>SGST (${((order.taxRate || 0) / 2).toFixed(1)}%):</span><span>+${sym}${(Number(order.sgstAmount) || 0).toFixed(2)}</span></div>
    ` : `
      <div class="row-meta"><span>Tax (${order.taxRate || 0}%):</span><span>+${sym}${(Number(order.taxAmount) || 0).toFixed(2)}</span></div>
    `}
  ` : ''}

  <div class="double-divider"></div>
  <div class="row-meta font-bold" style="font-size: ${is58mm ? '12px' : '14px'};">
    <span>GRAND TOTAL:</span>
    <span>${sym}${(Number(order.grandTotal) || 0).toFixed(2)}</span>
  </div>
  <div class="double-divider"></div>

  <div class="row-meta"><span>Payment Mode:</span><span class="font-bold">${order.paymentMethod}</span></div>
  ${order.paymentMethod === 'CASH' && order.paymentDetails?.amountReceived != null ? `
    <div class="row-meta"><span>Cash Received:</span><span>${sym}${(Number(order.paymentDetails.amountReceived) || 0).toFixed(2)}</span></div>
    ${order.paymentDetails.changeGiven != null ? `
      <div class="row-meta font-bold"><span>Change Returned:</span><span>${sym}${(Number(order.paymentDetails.changeGiven) || 0).toFixed(2)}</span></div>
    ` : ''}
  ` : ''}
  ${order.paymentMethod === 'UPI' && order.paymentDetails?.upiReference ? `
    <div class="row-meta"><span>UPI Ref ID:</span><span style="font-family: monospace;">${order.paymentDetails.upiReference}</span></div>
  ` : ''}
  ${order.paymentMethod === 'CARD' && order.paymentDetails?.cardLast4 ? `
    <div class="row-meta"><span>Card Ending:</span><span>**** ${order.paymentDetails.cardLast4}</span></div>
  ` : ''}

  <div class="divider"></div>
  <div class="text-center" style="margin-top: 6px;">
    <div class="barcode">
      <div class="bar"></div><div class="bar-thin"></div><div class="bar-thick"></div><div class="bar-thin"></div><div class="bar"></div>
      <div class="bar-thick"></div><div class="bar"></div><div class="bar-thin"></div><div class="bar-thick"></div><div class="bar"></div>
    </div>
    <div style="font-size: 9px; font-family: monospace;">${order.orderNumber}</div>
  </div>

  ${settings.receiptFooter ? `<div class="text-center" style="font-size: 10px; margin-top: 6px; white-space: pre-line;">${settings.receiptFooter}</div>` : ''}
  ${settings.receiptTerms ? `<div class="text-center" style="font-size: 8px; font-style: italic; margin-top: 4px;">${settings.receiptTerms}</div>` : ''}

  <div class="text-center font-bold" style="font-size: 10px; margin-top: 8px; letter-spacing: 1px;">*** THANK YOU - VISIT AGAIN ***</div>
</body>
</html>`;
  }

  /**
   * Browser-based Print Trigger:
   * Directly prints via a hidden iframe to the thermal printer without opening any Chrome window or popup
   */
  public printReceiptDOM(order?: Order, settings?: CafeSettings): boolean {
    if (typeof window === 'undefined') return false;

    if (order && settings) {
      const receiptHtml = this.generateReceiptHtml(order, settings);

      try {
        const iframe = document.createElement('iframe');
        iframe.setAttribute('title', 'Thermal Receipt Print');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.style.opacity = '0';
        iframe.style.pointerEvents = 'none';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(receiptHtml);
          doc.close();

          setTimeout(() => {
            try {
              iframe.contentWindow?.focus();
              iframe.contentWindow?.print();
            } catch (err) {
              console.warn('Thermal direct print failed:', err);
            }
            setTimeout(() => {
              try {
                if (document.body.contains(iframe)) {
                  document.body.removeChild(iframe);
                }
              } catch {}
            }, 2500);
          }, 80);
        }
        return true;
      } catch (e) {
        console.warn('Hidden iframe creation failed:', e);
      }
    }

    try {
      window.print();
    } catch (e) {
      console.warn('Direct print fallback failed:', e);
    }

    return true;
  }

  /**
   * Generates ESC/POS byte sequence for direct thermal hardware integration (USB/Network/Bluetooth bridge)
   */
  public generateEscPosBytes(order: Order, settings: CafeSettings): Uint8Array {
    const encoder = new TextEncoder();
    const rawText = this.generateMonospaceReceipt(order, settings);
    const textBytes = encoder.encode(rawText);

    // ESC @ (Initialize) + ESC p 0 25 250 (Cash Drawer) + Text + GS V 65 0 (Cut)
    const initCmd = new Uint8Array([0x1b, 0x40]);
    const drawerCmd = order.paymentMethod === 'CASH' ? new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]) : new Uint8Array([]);
    const cutCmd = new Uint8Array([0x1d, 0x56, 0x41, 0x03]); // Full cut with 3 line feed

    const totalLen = initCmd.length + drawerCmd.length + textBytes.length + cutCmd.length;
    const combined = new Uint8Array(totalLen);

    let offset = 0;
    combined.set(initCmd, offset);
    offset += initCmd.length;
    if (drawerCmd.length) {
      combined.set(drawerCmd, offset);
      offset += drawerCmd.length;
    }
    combined.set(textBytes, offset);
    offset += textBytes.length;
    combined.set(cutCmd, offset);

    return combined;
  }

  /**
   * Download receipt as text file for offline archiving / testing
   */
  public downloadReceiptFile(order: Order, settings: CafeSettings): void {
    const text = this.generateMonospaceReceipt(order, settings);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Receipt_${order.orderNumber}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export const posPrinter = new PosPrinterService();
