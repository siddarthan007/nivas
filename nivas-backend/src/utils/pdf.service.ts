import PdfPrinter from 'pdfmake/src/Printer';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { PassThrough } from 'stream';

const fonts = {
    Roboto: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique'
    }
};

const printer = new PdfPrinter(fonts);

export const PdfService = {
    async generatePdf(docDefinition: TDocumentDefinitions): Promise<Buffer> {
        return new Promise(async (resolve, reject) => {
            try {
                let pdfDoc: any = printer.createPdfKitDocument(docDefinition);
                // Some pdfmake versions return a Promise
                if (pdfDoc && typeof pdfDoc.then === 'function') {
                    pdfDoc = await pdfDoc;
                }
                if (!pdfDoc) {
                    return reject(new Error('createPdfKitDocument returned null'));
                }

                const chunks: any[] = [];

                // Prefer pipe() + PassThrough for reliability
                if (typeof pdfDoc.pipe === 'function') {
                    const stream = new PassThrough();
                    stream.on('data', (chunk: any) => chunks.push(chunk));
                    stream.on('end', () => resolve(Buffer.concat(chunks)));
                    stream.on('error', (err: any) => reject(err));
                    pdfDoc.pipe(stream);
                    pdfDoc.end();
                } else if (typeof pdfDoc.on === 'function') {
                    pdfDoc.on('data', (chunk: any) => chunks.push(chunk));
                    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
                    pdfDoc.on('error', (err: any) => reject(err));
                    pdfDoc.end();
                } else {
                    reject(new Error(`Unexpected pdfDoc type: ${typeof pdfDoc}`));
                }
            } catch (err: any) {
                reject(new Error(`PDF document creation failed: ${err.message}`));
            }
        });
    },

    /**
     * Generic tabular report PDF (Sales/Income, Payment Collection, Purchase/Expense).
     * data: { hotelName, title, from, to, columns[], rows[][], summary[] }
     */
    generateReportDefinition(data: any): TDocumentDefinitions {
        const cols: string[] = data.columns || [];
        // Last column (amount) right-aligned.
        const widths = cols.map((_, i) => (i === 0 ? 'auto' : i === cols.length - 1 ? 'auto' : '*'));
        return {
            content: [
                { text: data.hotelName || 'Hotel', style: 'header' },
                { text: data.title || 'Report', style: 'title', margin: [0, 4, 0, 2] },
                { text: `Period: ${data.from} to ${data.to}`, style: 'subheader', margin: [0, 0, 0, 12] },
                {
                    table: {
                        headerRows: 1,
                        widths,
                        body: [
                            cols.map((c: string, i: number) => ({ text: c, style: 'tableHeader', alignment: i === cols.length - 1 ? 'right' : 'left' })),
                            ...(data.rows || []).map((r: any[]) =>
                                r.map((cell, i) => ({ text: String(cell ?? ''), fontSize: 9, alignment: i === cols.length - 1 ? 'right' : 'left' }))
                            ),
                        ],
                    },
                    layout: 'lightHorizontalLines',
                },
                { text: '', margin: [0, 12] },
                {
                    table: {
                        widths: ['*', 'auto'],
                        body: (data.summary || []).map((s: any) => [
                            { text: s.label, bold: true, alignment: 'right', fontSize: 10 },
                            { text: String(s.value), alignment: 'right', fontSize: 10 },
                        ]),
                    },
                    layout: 'noBorders',
                },
                { text: `Generated ${new Date().toLocaleString()}`, style: 'footer', margin: [0, 16, 0, 0] },
            ],
            styles: {
                header: { fontSize: 16, bold: true, alignment: 'center' },
                title: { fontSize: 13, bold: true, alignment: 'center' },
                subheader: { fontSize: 10, alignment: 'center', color: '#555' },
                tableHeader: { bold: true, fontSize: 10, color: 'black', fillColor: '#eeeeee' },
                footer: { fontSize: 8, italics: true, color: '#777', alignment: 'right' },
            },
        };
    },

    generateInvoiceDefinition(data: any): TDocumentDefinitions {
        const h = data.hotel || {};
        const inv = data.invoice || {};
        const totals = data.totals || {};
        const cur = h.currency || inv.currency || 'NPR';

        // Brand palette derived from the hotel's primary colour.
        const accent = (typeof h.primaryColor === 'string' && /^#?[0-9a-fA-F]{6}$/.test(h.primaryColor))
            ? (h.primaryColor.startsWith('#') ? h.primaryColor : `#${h.primaryColor}`)
            : '#1a365d';
        const primary = '#1F2937';
        const muted = '#6B7280';
        const border = '#E5E7EB';
        const lightBg = '#F9FAFB';

        const money = (n: number) => `${cur} ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        const scPct = Math.round((parseFloat(h.serviceChargeRate ?? '0.10') > 1 ? parseFloat(h.serviceChargeRate) : parseFloat(h.serviceChargeRate ?? '0.10') * 100));
        const vatPct = Math.round((parseFloat(h.vatRate ?? '0.13') > 1 ? parseFloat(h.vatRate) : parseFloat(h.vatRate ?? '0.13') * 100));
        const paid = (inv.paymentStatus || 'PAID');

        const totalsRows: any[] = [
            [{ text: 'Sub Total', style: 'totalLabel' }, { text: money(totals.subTotal), style: 'totalValue', alignment: 'right' }],
        ];
        if (h.showTaxBreakdown !== false) {
            totalsRows.push([{ text: `Service Charge (${scPct}%)`, style: 'totalLabel' }, { text: money(totals.serviceCharge), style: 'totalValue', alignment: 'right' }]);
            totalsRows.push([{ text: `VAT (${vatPct}%)`, style: 'totalLabel' }, { text: money(totals.vat), style: 'totalValue', alignment: 'right' }]);
        }
        if ((totals.discount || 0) > 0) {
            totalsRows.push([{ text: 'Discount', style: 'totalLabel' }, { text: `- ${money(totals.discount)}`, style: 'totalValue', alignment: 'right' }]);
        }
        totalsRows.push([
            { text: 'Grand Total', style: 'grandTotalLabel', fillColor: lightBg },
            { text: money(totals.grandTotal), style: 'grandTotalValue', alignment: 'right', fillColor: lightBg },
        ]);

        return {
            pageMargins: [40, 40, 40, 50],
            content: [
                // Header: brand (left) + TAX INVOICE meta (right)
                {
                    columns: [
                        {
                            width: '*',
                            stack: [
                                { text: h.name || 'Hotel', style: 'brandName' },
                                ...(h.address ? [{ text: h.address, style: 'brandDetail', margin: [0, 3, 0, 0] }] : []),
                                { text: [h.phone ? `Tel: ${h.phone}` : '', h.email ? `  Email: ${h.email}` : ''].join(''), style: 'brandDetail' },
                                { text: [h.panNumber ? `PAN: ${h.panNumber}` : '', h.vatNumber ? `   VAT: ${h.vatNumber}` : ''].join(''), style: 'brandDetail' },
                            ],
                        },
                        {
                            width: 'auto',
                            stack: [
                                { text: h.headerNote || 'TAX INVOICE', style: 'docTitle' },
                                { text: inv.invoiceNumber || '', style: 'docMetaValue', margin: [0, 4, 0, 0] },
                                { text: 'Date', style: 'docMetaLabel' },
                                { text: `${inv.dateAd || ''}${inv.dateBs ? ` (BS ${inv.dateBs})` : ''}`, style: 'docMetaValue' },
                                { text: 'Status', style: 'docMetaLabel' },
                                { text: paid, style: 'docMetaValue', color: paid === 'PAID' ? '#166534' : '#92400e' },
                            ],
                            alignment: 'right',
                        },
                    ],
                    margin: [0, 0, 0, 14],
                },

                // Accent bar in the hotel's brand colour
                { canvas: [{ type: 'rect', x: 0, y: 0, w: 515, h: 3, color: accent }] },
                { text: '', margin: [0, 12] },

                // Billed To
                {
                    stack: [
                        { text: 'BILLED TO', style: 'sectionLabel' },
                        { text: inv.guestName || 'Guest', style: 'entityName', margin: [0, 4, 0, 1] },
                        ...(inv.guestPan ? [{ text: `PAN: ${inv.guestPan}`, style: 'entityDetail' }] : []),
                        ...(inv.guestPhone ? [{ text: `Phone: ${inv.guestPhone}`, style: 'entityDetail' }] : []),
                    ],
                    margin: [0, 0, 0, 18],
                },

                // Line items
                {
                    table: {
                        headerRows: 1,
                        widths: ['*', 70, 40, 90],
                        body: [
                            [
                                { text: 'Description', style: 'tableHeader' },
                                { text: 'Rate', style: 'tableHeader', alignment: 'right' },
                                { text: 'Qty', style: 'tableHeader', alignment: 'center' },
                                { text: 'Amount', style: 'tableHeader', alignment: 'right' },
                            ],
                            ...data.lineItems.map((item: any) => [
                                { text: item.description, style: 'tableCell' },
                                { text: Number(item.rate || 0).toFixed(2), style: 'tableCell', alignment: 'right' },
                                { text: String(item.quantity), style: 'tableCell', alignment: 'center' },
                                { text: Number(item.amount || 0).toFixed(2), style: 'tableCell', alignment: 'right' },
                            ]),
                        ],
                    },
                    layout: {
                        fillColor: (rowIndex: number) => rowIndex === 0 ? lightBg : null,
                        hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.5,
                        vLineWidth: () => 0,
                        hLineColor: () => border,
                        paddingLeft: () => 10, paddingRight: () => 10, paddingTop: () => 7, paddingBottom: () => 7,
                    },
                    margin: [0, 0, 0, 14],
                },

                // Totals (right)
                {
                    columns: [
                        { width: '*', text: '' },
                        {
                            width: 'auto',
                            table: { widths: [150, 110], body: totalsRows },
                            layout: {
                                hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length) ? 1 : 0.5,
                                hLineColor: () => border, vLineWidth: () => 0,
                                paddingLeft: () => 10, paddingRight: () => 10, paddingTop: () => 6, paddingBottom: () => 6,
                            },
                        },
                    ],
                    margin: [0, 0, 0, 14],
                },

                // Amount in words
                {
                    text: [
                        { text: 'Amount in words: ', style: 'wordsLabel' },
                        { text: `${this.numberToWords(Math.round(totals.grandTotal || 0))} Only`, style: 'wordsValue' },
                    ],
                    margin: [0, 0, 0, 18],
                },

                ...(h.invoiceFooterText ? [{ text: h.invoiceFooterText, style: 'footer', margin: [0, 6, 0, 0], alignment: 'center' }] : []),
                { text: 'This is a computer-generated invoice.', style: 'footerMuted', margin: [0, 16, 0, 0], alignment: 'center' },
            ],
            defaultStyle: { font: 'Roboto', fontSize: 10, color: primary },
            styles: {
                brandName: { fontSize: 20, bold: true, color: accent },
                brandDetail: { fontSize: 9, color: muted, margin: [0, 1, 0, 0] },
                docTitle: { fontSize: 17, bold: true, color: accent, alignment: 'right' },
                docMetaLabel: { fontSize: 8, color: muted, margin: [0, 4, 0, 0], alignment: 'right' },
                docMetaValue: { fontSize: 10, bold: true, color: primary, alignment: 'right' },
                sectionLabel: { fontSize: 9, bold: true, color: muted, characterSpacing: 1 },
                entityName: { fontSize: 12, bold: true, color: primary },
                entityDetail: { fontSize: 9, color: primary, margin: [0, 1, 0, 0] },
                tableHeader: { fontSize: 9, bold: true, color: primary },
                tableCell: { fontSize: 10, color: primary },
                totalLabel: { fontSize: 10, color: muted },
                totalValue: { fontSize: 10, color: primary },
                grandTotalLabel: { fontSize: 11, bold: true, color: primary },
                grandTotalValue: { fontSize: 11, bold: true, color: accent },
                wordsLabel: { fontSize: 9, color: muted },
                wordsValue: { fontSize: 10, italics: true, color: primary },
                footer: { fontSize: 9, italics: true, color: muted },
                footerMuted: { fontSize: 8, color: muted },
            },
        };
    },

    generateSaasInvoiceDefinition(data: any): TDocumentDefinitions {
        // taxRate/serviceChargeRate are stored as decimals (0.13 = 13%, 0.10 = 10%)
        let taxRateDecimal = typeof data.taxRate === 'number' && !isNaN(data.taxRate) ? data.taxRate : 0.13;
        let serviceChargeDecimal = typeof data.serviceChargeRate === 'number' && !isNaN(data.serviceChargeRate) ? data.serviceChargeRate : 0.10;
        if (taxRateDecimal > 1) taxRateDecimal = taxRateDecimal / 100;
        if (serviceChargeDecimal > 1) serviceChargeDecimal = serviceChargeDecimal / 100;
        let grandTotal = typeof data.amount === 'number' && !isNaN(data.amount) ? data.amount : 0;
        if (grandTotal < 0) grandTotal = 0;

        // Amount is INCLUSIVE of VAT and service charge.
        // Reverse-calculate: grandTotal = subtotal * (1 + scRate) * (1 + vatRate)
        // subtotal = grandTotal / ((1 + scRate) * (1 + vatRate))
        const inclusiveMultiplier = (1 + serviceChargeDecimal) * (1 + taxRateDecimal);
        const subtotal = grandTotal / inclusiveMultiplier;
        const serviceCharge = subtotal * serviceChargeDecimal;
        const taxableAmount = subtotal + serviceCharge;
        const vat = taxableAmount * taxRateDecimal;

        const taxPercent = Math.round(taxRateDecimal * 100);
        const serviceChargePercent = Math.round(serviceChargeDecimal * 100);

        const periodText = data.periodStart && data.periodEnd
            ? `${data.periodStart} to ${data.periodEnd}`
            : data.billingCycle || 'Monthly';

        const primaryColor = '#2D2D3A';
        const accentColor = '#4F46E5';
        const textColor = '#1F2937';
        const mutedColor = '#6B7280';
        const borderColor = '#E5E7EB';
        const lightBg = '#F9FAFB';

        return {
            content: [
                // Professional Header with colored accent bar
                {
                    columns: [
                        {
                            width: '*',
                            text: [
                                { text: 'NIVAS PMS', style: 'brandName' },
                                { text: '\nHotel Management System', style: 'brandTagline' },
                                { text: '\nKathmandu, Nepal', style: 'brandAddress' },
                                { text: '\nsupport@nivaspms.com | +977-1-4XXXXXX', style: 'brandAddress' },
                                { text: '\nPAN: 123456789 | VAT: 987654321', style: 'brandAddress' }
                            ]
                        },
                        {
                            width: 'auto',
                            text: [
                                { text: 'TAX INVOICE', style: 'docTitle' },
                                { text: `\n${data.invoiceNumber}`, style: 'docMetaValue' },
                                { text: '\nInvoice Date', style: 'docMetaLabel' },
                                { text: data.date, style: 'docMetaValue' },
                                { text: '\nPayment Method', style: 'docMetaLabel' },
                                { text: data.paymentMethod || 'PENDING', style: 'docMetaValue' }
                            ],
                            alignment: 'right'
                        }
                    ],
                    margin: [0, 0, 0, 16]
                },

                // Accent bar
                { canvas: [{ type: 'rect', x: 0, y: 0, w: 515, h: 3, color: accentColor }] },
                { text: '', margin: [0, 12] },

                // Two-column info: Billed To + Subscription Details
                {
                    columns: [
                        {
                            width: '*',
                            stack: [
                                { text: 'BILLED TO', style: 'sectionLabel' },
                                { text: data.hotelName, style: 'entityName', margin: [0, 4, 0, 2] },
                                { text: data.address || 'N/A', style: 'entityDetail' },
                                { text: `PAN: ${data.panNumber || 'N/A'}`, style: 'entityDetail' },
                                { text: `VAT: ${data.vatNumber || 'N/A'}`, style: 'entityDetail' },
                                { text: `License: ${data.licenseKey || 'N/A'}`, style: 'entityDetail' }
                            ]
                        },
                        {
                            width: 'auto',
                            stack: [
                                { text: 'SUBSCRIPTION', style: 'sectionLabel', alignment: 'right' },
                                { text: data.packageName || 'Subscription', style: 'entityName', alignment: 'right', margin: [0, 4, 0, 2] },
                                { text: `Cycle: ${data.billingCycle || 'Monthly'}`, style: 'entityDetail', alignment: 'right' },
                                { text: `Period: ${periodText}`, style: 'entityDetail', alignment: 'right' }
                            ]
                        }
                    ],
                    margin: [0, 0, 0, 20]
                },

                // Line Items Table
                {
                    table: {
                        headerRows: 1,
                        widths: ['*', 80, 50, 90],
                        body: [
                            [
                                { text: 'Description', style: 'tableHeader' },
                                { text: 'Rate', style: 'tableHeader', alignment: 'right' },
                                { text: 'Qty', style: 'tableHeader', alignment: 'center' },
                                { text: 'Amount', style: 'tableHeader', alignment: 'right' }
                            ],
                            [
                                { text: `${data.packageName || 'Software Subscription'} — ${data.billingCycle || 'Monthly'}`, style: 'tableCell' },
                                { text: subtotal.toFixed(2), style: 'tableCell', alignment: 'right' },
                                { text: '1', style: 'tableCell', alignment: 'center' },
                                { text: subtotal.toFixed(2), style: 'tableCell', alignment: 'right' }
                            ]
                        ]
                    },
                    layout: {
                        fillColor: (rowIndex: number) => rowIndex === 0 ? lightBg : null,
                        hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.5,
                        vLineWidth: () => 0,
                        hLineColor: () => borderColor,
                        paddingLeft: () => 10,
                        paddingRight: () => 10,
                        paddingTop: () => 8,
                        paddingBottom: () => 8
                    },
                    margin: [0, 0, 0, 16]
                },

                // Totals right-aligned
                {
                    columns: [
                        { width: '*', text: '' },
                        {
                            width: 'auto',
                            table: {
                                widths: [140, 100],
                                body: [
                                    [{ text: 'Subtotal', style: 'totalLabel' }, { text: `${data.currency} ${subtotal.toFixed(2)}`, style: 'totalValue', alignment: 'right' }],
                                    [{ text: `Service Charge (${serviceChargePercent}%)`, style: 'totalLabel' }, { text: `${data.currency} ${serviceCharge.toFixed(2)}`, style: 'totalValue', alignment: 'right' }],
                                    [{ text: `VAT (${taxPercent}%)`, style: 'totalLabel' }, { text: `${data.currency} ${vat.toFixed(2)}`, style: 'totalValue', alignment: 'right' }],
                                    [
                                        { text: 'Grand Total', style: 'grandTotalLabel', fillColor: lightBg },
                                        { text: `${data.currency} ${grandTotal.toFixed(2)}`, style: 'grandTotalValue', alignment: 'right', fillColor: lightBg }
                                    ]
                                ]
                            },
                            layout: {
                                hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length) ? 1 : 0.5,
                                hLineColor: () => borderColor,
                                vLineWidth: () => 0,
                                paddingLeft: () => 10,
                                paddingRight: () => 10,
                                paddingTop: () => 6,
                                paddingBottom: () => 6
                            }
                        }
                    ],
                    margin: [0, 0, 0, 16]
                },

                // Amount in words
                {
                    text: [
                        { text: 'Amount in words: ', style: 'wordsLabel' },
                        { text: `${this.numberToWords(Math.round(grandTotal))} Only`, style: 'wordsValue' }
                    ],
                    margin: [0, 0, 0, 20]
                },

                // Terms
                {
                    text: 'TERMS & CONDITIONS',
                    style: 'sectionLabel',
                    margin: [0, 0, 0, 6]
                },
                {
                    stack: [
                        { text: '1. Payment is due within 15 days of invoice date.', style: 'termItem' },
                        { text: '2. Late payments may result in subscription suspension.', style: 'termItem' },
                        { text: '3. This invoice is electronically generated and is valid without signature.', style: 'termItem' },
                        { text: '4. For billing queries contact: billing@nivaspms.com', style: 'termItem' }
                    ],
                    margin: [0, 0, 0, 24]
                },

                // Signature row
                {
                    columns: [
                        {
                            width: '*',
                            stack: [
                                { text: 'Authorized Signature', style: 'sigLabel' },
                                { canvas: [{ type: 'line', x1: 0, y1: 24, x2: 160, y2: 24, lineWidth: 0.5, lineColor: mutedColor }] },
                                { text: 'NIVAS PMS Billing Department', style: 'sigSub', margin: [0, 4, 0, 0] }
                            ]
                        },
                        {
                            width: '*',
                            stack: [
                                { text: 'Customer Acknowledgement', style: 'sigLabel', alignment: 'right' },
                                { canvas: [{ type: 'line', x1: 0, y1: 24, x2: 160, y2: 24, lineWidth: 0.5, lineColor: mutedColor }], alignment: 'right' },
                                { text: `${data.hotelName}`, style: 'sigSub', alignment: 'right', margin: [0, 4, 0, 0] }
                            ]
                        }
                    ],
                    margin: [0, 16, 0, 0]
                },

                // Footer
                { text: 'Thank you for choosing NIVAS PMS', style: 'footerText', margin: [0, 28, 0, 0], alignment: 'center' }
            ],
            defaultStyle: {
                font: 'Roboto',
                fontSize: 10,
                color: textColor
            },
            styles: {
                brandName: { fontSize: 22, bold: true, color: primaryColor },
                brandTagline: { fontSize: 10, color: mutedColor, margin: [0, 2, 0, 0] },
                brandAddress: { fontSize: 9, color: mutedColor },
                docTitle: { fontSize: 18, bold: true, color: accentColor, alignment: 'right' },
                docMetaLabel: { fontSize: 8, color: mutedColor, margin: [0, 4, 0, 0], alignment: 'right' },
                docMetaValue: { fontSize: 10, bold: true, color: primaryColor, alignment: 'right' },
                sectionLabel: { fontSize: 9, bold: true, color: mutedColor, letterSpacing: 1 },
                entityName: { fontSize: 12, bold: true, color: primaryColor },
                entityDetail: { fontSize: 9, color: textColor, margin: [0, 1, 0, 0] },
                tableHeader: { fontSize: 9, bold: true, color: primaryColor },
                tableCell: { fontSize: 10, color: textColor },
                totalLabel: { fontSize: 10, color: mutedColor },
                totalValue: { fontSize: 10, color: textColor },
                grandTotalLabel: { fontSize: 11, bold: true, color: primaryColor },
                grandTotalValue: { fontSize: 11, bold: true, color: accentColor },
                wordsLabel: { fontSize: 9, color: mutedColor },
                wordsValue: { fontSize: 10, italics: true, color: textColor },
                termItem: { fontSize: 9, color: mutedColor, margin: [0, 2, 0, 0] },
                sigLabel: { fontSize: 9, bold: true, color: mutedColor },
                sigSub: { fontSize: 8, color: mutedColor },
                footerText: { fontSize: 9, color: mutedColor }
            }
        };
    },

    numberToWords(num: number): string {
        const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
        const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

        if (num === 0) return 'Zero';

        function convertLessThanOneThousand(n: number): string {
            if (n < 20) return ones[n] as string;
            if (n < 100) return (tens[Math.floor(n / 10)] as string) + (n % 10 !== 0 ? ' ' + (ones[n % 10] as string) : '');
            return (ones[Math.floor(n / 100)] as string) + ' Hundred' + (n % 100 !== 0 ? ' ' + convertLessThanOneThousand(n % 100) : '');
        }

        let result = '';
        if (num >= 10000000) {
            result += convertLessThanOneThousand(Math.floor(num / 10000000)) + ' Crore ';
            num %= 10000000;
        }
        if (num >= 100000) {
            result += convertLessThanOneThousand(Math.floor(num / 100000)) + ' Lakh ';
            num %= 100000;
        }
        if (num >= 1000) {
            result += convertLessThanOneThousand(Math.floor(num / 1000)) + ' Thousand ';
            num %= 1000;
        }
        if (num > 0) {
            result += convertLessThanOneThousand(num);
        }
        return result.trim();
    }
};
