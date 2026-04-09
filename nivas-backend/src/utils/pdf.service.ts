import PdfPrinter from 'pdfmake/src/printer';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';

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
        return new Promise((resolve, reject) => {
            const pdfDoc = printer.createPdfKitDocument(docDefinition);
            const chunks: any[] = [];
            pdfDoc.on('data', (chunk: any) => chunks.push(chunk));
            pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
            pdfDoc.on('error', (err: any) => reject(err));
            pdfDoc.end();
        });
    },

    generateInvoiceDefinition(data: any): TDocumentDefinitions {
        return {
            content: [
                { text: data.hotel.name, style: 'header' },
                { text: data.hotel.address, style: 'subheader' },
                { text: `Tel: ${data.hotel.phone} | Email: ${data.hotel.email}`, style: 'subheader' },
                { text: `PAN: ${data.hotel.panNumber}`, style: 'subheader', margin: [0, 0, 0, 20] },

                { text: 'INVOICE', style: 'title', margin: [0, 0, 0, 10] },

                {
                    columns: [
                        {
                            width: '*',
                            text: [
                                { text: 'To:\n', bold: true },
                                { text: data.invoice.guestName + '\n' },
                                { text: data.invoice.guestPan ? `PAN: ${data.invoice.guestPan}\n` : '' }
                            ]
                        },
                        {
                            width: 'auto',
                            text: [
                                { text: `Invoice No: ${data.invoice.invoiceNumber}\n`, bold: true },
                                { text: `Date: ${data.invoice.dateAd} (${data.invoice.dateBs})\n` },
                                { text: `Payment: ${data.invoice.paymentStatus}\n` }
                            ],
                            alignment: 'right'
                        }
                    ]
                },

                { text: '', margin: [0, 10] },

                {
                    table: {
                        headerRows: 1,
                        widths: ['*', 'auto', 'auto', 'auto'],
                        body: [
                            [
                                { text: 'Description', style: 'tableHeader' },
                                { text: 'Rate', style: 'tableHeader' },
                                { text: 'Qty', style: 'tableHeader' },
                                { text: 'Amount', style: 'tableHeader' }
                            ],
                            ...data.lineItems.map((item: any) => [
                                item.description,
                                item.rate.toFixed(2),
                                item.quantity,
                                item.amount.toFixed(2)
                            ]),
                            // Totals
                            [{ text: 'Sub Total', colSpan: 3, bold: true, alignment: 'right' }, {}, {}, data.totals.subTotal.toFixed(2)],
                            [{ text: `Service Charge (${data.hotel.serviceChargeRate || 10}%)`, colSpan: 3, bold: true, alignment: 'right' }, {}, {}, data.totals.serviceCharge.toFixed(2)],
                            [{ text: `VAT (${data.hotel.vatRate || 13}%)`, colSpan: 3, bold: true, alignment: 'right' }, {}, {}, data.totals.vat.toFixed(2)],
                            [{ text: 'Grand Total', colSpan: 3, bold: true, alignment: 'right' }, {}, {}, { text: data.totals.grandTotal.toFixed(2), bold: true }]
                        ]
                    },
                    layout: 'lightHorizontalLines'
                },

                { text: data.hotel.invoiceFooterText, style: 'footer', margin: [0, 20, 0, 0], alignment: 'center' }
            ],
            styles: {
                header: { fontSize: 18, bold: true, alignment: 'center' },
                subheader: { fontSize: 10, alignment: 'center', color: '#555' },
                title: { fontSize: 14, bold: true, alignment: 'center', decoration: 'underline' },
                tableHeader: { bold: true, fontSize: 11, color: 'black', fillColor: '#eeeeee' },
                footer: { fontSize: 9, italics: true, color: '#777' }
            }
        };
    },

    generateSaasInvoiceDefinition(data: any): TDocumentDefinitions {
        return {
            content: [
                { text: 'NIVAS PMS', style: 'header' }, // System Branding
                { text: 'Kathmandu, Nepal', style: 'subheader' },
                { text: 'Tel: +977-1-4XXXXXX | Email: support@nivaspms.com', style: 'subheader' },
                { text: 'PAN: 123456789', style: 'subheader', margin: [0, 0, 0, 20] },

                { text: 'TAX INVOICE', style: 'title', margin: [0, 0, 0, 10] },

                {
                    columns: [
                        {
                            width: '*',
                            text: [
                                { text: 'To:\n', bold: true },
                                { text: data.hotelName + '\n' },
                                { text: data.address + '\n' },
                                { text: `PAN: ${data.panNumber}\n` }
                            ]
                        },
                        {
                            width: 'auto',
                            text: [
                                { text: `Invoice No: ${data.invoiceNumber}\n`, bold: true },
                                { text: `Date: ${data.date}\n` },
                                { text: `Payment Method: ${data.paymentMethod}\n` }
                            ],
                            alignment: 'right'
                        }
                    ]
                },

                { text: '', margin: [0, 10] },

                {
                    table: {
                        headerRows: 1,
                        widths: ['*', 'auto', 'auto', 'auto'],
                        body: [
                            [
                                { text: 'Description', style: 'tableHeader' },
                                { text: 'Rate', style: 'tableHeader' },
                                { text: 'Qty', style: 'tableHeader' },
                                { text: 'Amount', style: 'tableHeader' }
                            ],
                            [
                                data.description,
                                data.amount.toFixed(2),
                                1,
                                data.amount.toFixed(2)
                            ],
                            // Totals (Simplified for SaaS as usually inclusive or simpler tax)
                            [{ text: 'Total', colSpan: 3, bold: true, alignment: 'right' }, {}, {}, { text: data.amount.toFixed(2), bold: true }]
                        ]
                    },
                    layout: 'lightHorizontalLines'
                },

                { text: 'Thank you for your business!', style: 'footer', margin: [0, 20, 0, 0], alignment: 'center' }
            ],
            styles: {
                header: { fontSize: 18, bold: true, alignment: 'center', color: '#2563eb' },
                subheader: { fontSize: 10, alignment: 'center', color: '#555' },
                title: { fontSize: 14, bold: true, alignment: 'center', decoration: 'underline' },
                tableHeader: { bold: true, fontSize: 11, color: 'black', fillColor: '#eeeeee' },
                footer: { fontSize: 9, italics: true, color: '#777' }
            }
        };
    }
};
