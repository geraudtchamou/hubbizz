/**
 * OCR Receipt Scanning Service
 * Converts supplier invoices/receipts into structured Purchase Orders
 * Uses Tesseract.js for client-side OCR + AI parsing for African receipt formats
 */

export interface OCRResult {
  rawText: string;
  confidence: number;
  detectedLanguage: 'en' | 'fr' | 'pt' | 'sw' | 'unknown';
}

export interface ParsedReceipt {
  supplierName?: string;
  supplierPhone?: string;
  supplierAddress?: string;
  invoiceNumber?: string;
  invoiceDate?: Date;
  dueDate?: Date;
  currency: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  lineItems: LineItem[];
  paymentTerms?: string;
  notes?: string;
  confidence: number;
  warnings: string[];
}

export interface LineItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  sku?: string;
  batchNumber?: string;
  expiryDate?: Date;
  category?: string;
}

export interface OCRProgress {
  stage: 'uploading' | 'processing' | 'parsing' | 'complete' | 'error';
  progress: number;
  message: string;
}

class OCRService {
  private tesseractWorker: Worker | null = null;
  
  /**
   * Initialize Tesseract worker for offline OCR
   */
  async initialize(): Promise<void> {
    if (this.tesseractWorker) return;
    
    try {
      const { createWorker } = await import('tesseract.js');
      this.tesseractWorker = await createWorker({
        logger: () => {}, // Silent logging
      });
      
      // Load languages commonly used in African receipts
      await this.tesseractWorker.loadLanguage('eng+fra');
      await this.tesseractWorker.initialize('eng+fra');
    } catch (error) {
      console.warn('Tesseract initialization failed, falling back to server OCR:', error);
    }
  }

  /**
   * Process receipt image and extract text
   */
  async scanReceipt(
    imageFile: File | Blob,
    onProgress?: (progress: OCRProgress) => void
  ): Promise<OCRResult> {
    onProgress?.({ stage: 'processing', progress: 10, message: 'Starting OCR...' });

    try {
      // Convert to base64 for processing
      const base64Image = await this.fileToBase64(imageFile);
      
      onProgress?.({ stage: 'processing', progress: 30, message: 'Running OCR engine...' });

      let rawText = '';
      let confidence = 0;

      if (this.tesseractWorker) {
        // Client-side OCR
        const result = await this.tesseractWorker.recognize(base64Image);
        rawText = result.data.text;
        confidence = result.data.confidence;
      } else {
        // Fallback to server-side OCR
        rawText = await this.serverSideOCR(imageFile);
        confidence = 85; // Estimated confidence
      }

      onProgress?.({ stage: 'parsing', progress: 60, message: 'Parsing receipt structure...' });

      // Detect language
      const detectedLanguage = this.detectLanguage(rawText);

      onProgress?.({ stage: 'complete', progress: 100, message: 'OCR complete' });

      return {
        rawText,
        confidence,
        detectedLanguage,
      };
    } catch (error) {
      onProgress?.({ 
        stage: 'error', 
        progress: 0, 
        message: error instanceof Error ? error.message : 'OCR failed' 
      });
      throw error;
    }
  }

  /**
   * Parse extracted text into structured receipt data
   * Optimized for African supplier receipt formats
   */
  parseReceiptText(ocrResult: OCRResult): ParsedReceipt {
    const { rawText, detectedLanguage } = ocrResult;
    const lines = rawText.split('\n').map(line => line.trim()).filter(Boolean);
    const warnings: string[] = [];
    
    // Initialize result
    const result: ParsedReceipt = {
      currency: this.detectCurrency(rawText),
      subtotal: 0,
      taxAmount: 0,
      totalAmount: 0,
      lineItems: [],
      confidence: ocrResult.confidence,
      warnings,
    };

    // Extract supplier info (first few lines usually contain this)
    const supplierBlock = lines.slice(0, Math.min(8, lines.length));
    result.supplierName = this.extractSupplierName(supplierBlock, detectedLanguage);
    result.supplierPhone = this.extractPhone(supplierBlock);
    result.supplierAddress = this.extractAddress(supplierBlock);

    // Extract invoice metadata
    result.invoiceNumber = this.extractInvoiceNumber(lines);
    result.invoiceDate = this.extractDate(lines, 'invoice');
    result.dueDate = this.extractDate(lines, 'due');
    result.paymentTerms = this.extractPaymentTerms(lines);

    // Extract line items
    result.lineItems = this.extractLineItems(lines, detectedLanguage);
    
    if (result.lineItems.length === 0) {
      warnings.push('No line items detected. Manual verification required.');
    }

    // Calculate totals from line items
    const calculatedSubtotal = result.lineItems.reduce((sum, item) => sum + item.totalPrice, 0);
    
    // Try to extract explicit totals from receipt
    const extractedTotals = this.extractTotals(lines, result.currency);
    
    if (extractedTotals.total !== undefined) {
      result.totalAmount = extractedTotals.total;
      result.subtotal = extractedTotals.subtotal || calculatedSubtotal;
      result.taxAmount = extractedTotals.tax || (result.totalAmount - result.subtotal);
    } else {
      // Fall back to calculated values
      result.subtotal = calculatedSubtotal;
      result.taxAmount = calculatedSubtotal * 0.18; // Default 18% VAT assumption
      result.totalAmount = result.subtotal + result.taxAmount;
      warnings.push('Totals estimated from line items. Verify with original receipt.');
    }

    // Extract notes
    result.notes = this.extractNotes(lines);

    return result;
  }

  /**
   * Create purchase order from parsed receipt
   */
  async createPurchaseOrderFromReceipt(
    parsedReceipt: ParsedReceipt,
    storeId: string,
    options?: {
      autoApprove?: boolean;
      notifyManager?: boolean;
      addMissingProducts?: boolean;
    }
  ): Promise<{
    purchaseOrderId: string;
    status: 'draft' | 'pending' | 'approved';
    createdItems: number;
    skippedItems: number;
    warnings: string[];
  }> {
    const { autoApprove = false, notifyManager = false, addMissingProducts = true } = options || {};
    
    // Validate required fields
    if (!parsedReceipt.supplierName) {
      throw new Error('Supplier name not detected. Cannot create purchase order.');
    }

    // Find or create supplier
    const supplier = await this.findOrCreateSupplier({
      name: parsedReceipt.supplierName,
      phone: parsedReceipt.supplierPhone,
      address: parsedReceipt.supplierAddress,
    });

    let createdItems = 0;
    let skippedItems = 0;
    const warnings: string[] = [...parsedReceipt.warnings];

    // Process line items
    const processedItems = await Promise.all(
      parsedReceipt.lineItems.map(async (item) => {
        try {
          // Find existing product or create new one
          let product = await this.findProductByName(item.productName);
          
          if (!product && addMissingProducts) {
            product = await this.createProduct({
              name: item.productName,
              category: item.category || 'Uncategorized',
              defaultCostPrice: item.unitPrice,
              currency: parsedReceipt.currency,
            });
            warnings.push(`Created new product: ${item.productName}`);
          } else if (!product) {
            skippedItems++;
            warnings.push(`Product not found and not created: ${item.productName}`);
            return null;
          }

          createdItems++;
          return {
            productId: product.id,
            quantity: item.quantity,
            costPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            batchNumber: item.batchNumber,
            expiryDate: item.expiryDate,
          };
        } catch (error) {
          skippedItems++;
          warnings.push(`Failed to process item ${item.productName}: ${error}`);
          return null;
        }
      })
    );

    const validItems = processedItems.filter(Boolean);

    // Create purchase order
    const purchaseOrder = {
      id: `PO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      storeId,
      supplierId: supplier.id,
      invoiceNumber: parsedReceipt.invoiceNumber,
      invoiceDate: parsedReceipt.invoiceDate,
      dueDate: parsedReceipt.dueDate,
      currency: parsedReceipt.currency,
      subtotal: parsedReceipt.subtotal,
      taxAmount: parsedReceipt.taxAmount,
      totalAmount: parsedReceipt.totalAmount,
      items: validItems,
      status: autoApprove ? 'approved' : 'pending',
      createdAt: new Date(),
      notes: parsedReceipt.notes,
      source: 'ocr_scan',
      ocrConfidence: parsedReceipt.confidence,
    };

    // Save to database
    await this.savePurchaseOrder(purchaseOrder);

    // Notify manager if requested
    if (notifyManager && !autoApprove) {
      await this.notifyManagerReview(purchaseOrder);
    }

    return {
      purchaseOrderId: purchaseOrder.id,
      status: purchaseOrder.status,
      createdItems,
      skippedItems,
      warnings,
    };
  }

  // ==================== Helper Methods ====================

  private async fileToBase64(file: File | Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private async serverSideOCR(imageFile: File | Blob): Promise<string> {
    // Fallback implementation - in production, call your backend OCR service
    const formData = new FormData();
    formData.append('image', imageFile);
    
    const response = await fetch('/api/ocr/scan', {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error('Server OCR failed');
    }
    
    const data = await response.json();
    return data.text;
  }

  private detectLanguage(text: string): OCRResult['detectedLanguage'] {
    const frenchPatterns = ['facture', 'total', 'quantité', 'prix unitaire'];
    const portuguesePatterns = ['fatura', 'total', 'quantidade', 'preço'];
    const swahiliPatterns = ['hesabu', 'jumla', 'idadi'];
    
    const lowerText = text.toLowerCase();
    
    if (frenchPatterns.some(p => lowerText.includes(p))) return 'fr';
    if (portuguesePatterns.some(p => lowerText.includes(p))) return 'pt';
    if (swahiliPatterns.some(p => lowerText.includes(p))) return 'sw';
    return 'en';
  }

  private detectCurrency(text: string): string {
    const currencyMap: Record<string, string> = {
      '₦': 'NGN',
      'KSh': 'KES',
      'Rwf': 'RWF',
      'CFA': 'XOF',
      'FCFA': 'XAF',
      'GH₵': 'GHS',
      'R': 'ZAR',
      'TSh': 'TZS',
      'USh': 'UGX',
      'FBu': 'BIF',
      'CDF': 'CDF',
      'MRU': 'MRU',
      'NAD': 'NAD',
      'BWP': 'BWP',
      'SZL': 'SZL',
      'LSL': 'LSL',
      'MWK': 'MWK',
      'ZMW': 'ZMW',
      'AOA': 'AOA',
      'CVE': 'CVE',
      'GMD': 'GMD',
      'GNF': 'GNF',
      'LRD': 'LRD',
      'MGA': 'MGA',
      'MZN': 'MZN',
      'SLL': 'SLL',
      'STD': 'STD',
      'XPF': 'XPF',
    };

    for (const [symbol, code] of Object.entries(currencyMap)) {
      if (text.includes(symbol)) return code;
    }

    // Check for currency codes in text
    const codes = ['NGN', 'KES', 'GHS', 'XOF', 'XAF', 'ZAR', 'TZS', 'UGX'];
    for (const code of codes) {
      if (text.includes(code)) return code;
    }

    return 'USD'; // Default fallback
  }

  private extractSupplierName(lines: string[], language: string): string | undefined {
    // First non-empty line is often the supplier name
    const candidates = lines.slice(0, 5);
    
    // Filter out common receipt headers
    const skipPatterns = ['receipt', 'invoice', 'tax', 'vat', 'tel', 'phone', /\d{4}/];
    
    for (const line of candidates) {
      if (line.length < 3) continue;
      if (skipPatterns.some(p => typeof p === 'string' ? line.toLowerCase().includes(p) : p.test(line))) {
        continue;
      }
      return line;
    }
    
    return candidates[0];
  }

  private extractPhone(lines: string[]): string | undefined {
    const phonePattern = /(?:tel|phone|mob|call)[:\s]*(\+?\d[\d\s\-]{7,}\d)/i;
    
    for (const line of lines) {
      const match = line.match(phonePattern);
      if (match) return match[1].replace(/[\s\-]/g, '');
      
      // Standalone phone number pattern
      const standaloneMatch = line.match(/^(\+?\d[\d\s\-]{8,}\d)$/);
      if (standaloneMatch) return standaloneMatch[1].replace(/[\s\-]/g, '');
    }
    
    return undefined;
  }

  private extractAddress(lines: string[]): string | undefined {
    const addressKeywords = ['address', 'addr', 'location', 'street', 'road', 'avenue', 'plaza'];
    
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      if (addressKeywords.some(k => lowerLine.includes(k))) {
        return line.replace(/^(address|addr|location)[:\s]*/i, '');
      }
    }
    
    return undefined;
  }

  private extractInvoiceNumber(lines: string[]): string | undefined {
    const patterns = [
      /(?:invoice|inv|bill|ref|receipt)\s*#?\s*:?\s*([A-Z0-9\-]+)/i,
      /#([A-Z0-9\-]+)/,
    ];
    
    for (const line of lines) {
      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) return match[1];
      }
    }
    
    return undefined;
  }

  private extractDate(lines: string[], type: 'invoice' | 'due'): Date | undefined {
    const keywords = type === 'invoice' 
      ? ['date', 'dated', 'invoice date'] 
      : ['due', 'pay by', 'payment due'];
    
    const datePatterns = [
      /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/,
      /(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/,
      /(\w+)\s+(\d{1,2}),?\s+(\d{4})/,
    ];
    
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      if (!keywords.some(k => lowerLine.includes(k))) continue;
      
      for (const pattern of datePatterns) {
        const match = line.match(pattern);
        if (match) {
          const dateStr = match[0];
          const parsed = new Date(dateStr);
          if (!isNaN(parsed.getTime())) return parsed;
        }
      }
    }
    
    return undefined;
  }

  private extractPaymentTerms(lines: string[]): string | undefined {
    const termsKeywords = ['payment terms', 'terms', 'credit period', 'net'];
    
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      if (termsKeywords.some(k => lowerLine.includes(k))) {
        return line;
      }
    }
    
    return undefined;
  }

  private extractLineItems(lines: string[], language: string): LineItem[] {
    const items: LineItem[] = [];
    let inItemsSection = false;
    
    // Patterns for line items
    const itemPatterns = [
      // Format: Product Name Qty x Price = Total
      /^(.+?)\s+(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*=?\s*(\d+(?:\.\d+)?)$/,
      // Format: Product Name | Qty | Price | Total
      /^(.+?)\s*\|\s*(\d+(?:\.\d+)?)\s*\|\s*(\d+(?:\.\d+)?)\s*\|\s*(\d+(?:\.\d+)?)$/,
      // Format: Qty Product Name @ Price = Total
      /^(\d+(?:\.\d+)?)\s+(.+?)\s*@\s*(\d+(?:\.\d+)?)\s*=?\s*(\d+(?:\.\d+)?)$/,
    ];
    
    for (const line of lines) {
      // Detect start of items section
      if (/^items|^description|^qty|^product/i.test(line)) {
        inItemsSection = true;
        continue;
      }
      
      // Detect end of items section
      if (/^subtotal|^tax|^total|^balance/i.test(line)) {
        inItemsSection = false;
        continue;
      }
      
      if (!inItemsSection) continue;
      if (line.length < 5) continue;
      
      // Try each pattern
      for (const pattern of itemPatterns) {
        const match = line.match(pattern);
        if (match) {
          let productName: string;
          let quantity: number;
          let unitPrice: number;
          let totalPrice: number;
          
          // Determine format based on capture groups
          if (match[1].length > 10 || isNaN(Number(match[1]))) {
            // Product name first
            productName = match[1].trim();
            quantity = parseFloat(match[2]);
            unitPrice = parseFloat(match[3]);
            totalPrice = parseFloat(match[4]);
          } else {
            // Quantity first
            quantity = parseFloat(match[1]);
            productName = match[2].trim();
            unitPrice = parseFloat(match[3]);
            totalPrice = parseFloat(match[4]);
          }
          
          if (productName && quantity > 0 && totalPrice > 0) {
            items.push({
              productName,
              quantity,
              unitPrice: unitPrice || (totalPrice / quantity),
              totalPrice,
            });
            break;
          }
        }
      }
    }
    
    return items;
  }

  private extractTotals(lines: string[], currency: string): {
    subtotal?: number;
    tax?: number;
    total?: number;
  } {
    const result: { subtotal?: number; tax?: number; total?: number } = {};
    
    const totalPatterns = [
      { key: 'total', field: 'total' },
      { key: 'grand total', field: 'total' },
      { key: 'amount due', field: 'total' },
      { key: 'subtotal', field: 'subtotal' },
      { key: 'sub-total', field: 'subtotal' },
      { key: 'tax', field: 'tax' },
      { key: 'vat', field: 'tax' },
    ];
    
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      
      for (const { key, field } of totalPatterns) {
        if (lowerLine.includes(key)) {
          // Extract number after the keyword
          const numberMatch = line.match(/(\d+(?:,\d{3})*(?:\.\d+)?)/);
          if (numberMatch) {
            const value = parseFloat(numberMatch[1].replace(/,/g, ''));
            if (!isNaN(value)) {
              result[field as keyof typeof result] = value;
            }
          }
        }
      }
    }
    
    return result;
  }

  private extractNotes(lines: string[]): string | undefined {
    const noteKeywords = ['notes', 'remarks', 'comments', 'additional'];
    const notes: string[] = [];
    
    let inNotesSection = false;
    
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      
      if (noteKeywords.some(k => lowerLine.includes(k))) {
        inNotesSection = true;
        continue;
      }
      
      if (inNotesSection) {
        if (line.length < 3) {
          inNotesSection = false;
          continue;
        }
        notes.push(line);
      }
    }
    
    return notes.length > 0 ? notes.join(' ') : undefined;
  }

  // Mock database methods - replace with actual implementations
  private async findOrCreateSupplier(data: { name: string; phone?: string; address?: string }) {
    // In production: query your database
    return {
      id: `SUP-${Date.now()}`,
      ...data,
    };
  }

  private async findProductByName(name: string) {
    // In production: query your products table
    return null; // Simulate not found
  }

  private async createProduct(data: { name: string; category: string; defaultCostPrice: number; currency: string }) {
    // In production: insert into products table
    return {
      id: `PROD-${Date.now()}`,
      ...data,
    };
  }

  private async savePurchaseOrder(po: any) {
    // In production: insert into purchase_orders table
    console.log('Saving purchase order:', po);
  }

  private async notifyManagerReview(po: any) {
    // In production: send notification
    console.log('Notifying manager to review PO:', po.id);
  }
}

export const ocrService = new OCRService();
