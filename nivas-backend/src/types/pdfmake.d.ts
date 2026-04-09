declare module 'pdfmake/src/printer' {
    export default class PdfPrinter {
        constructor(fontDescriptors: Record<string, Record<string, string>>);
        createPdfKitDocument(docDefinition: unknown): {
            on(event: 'data', listener: (chunk: Buffer) => void): void;
            on(event: 'end', listener: () => void): void;
            on(event: 'error', listener: (error: Error) => void): void;
            end(): void;
        };
    }
}

declare module 'pdfmake/interfaces' {
    export interface TDocumentDefinitions {
        content?: unknown;
        styles?: Record<string, unknown>;
        [key: string]: unknown;
    }
}
