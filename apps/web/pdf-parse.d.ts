declare module 'pdf-parse' {
  type PdfParseResult = {
    text: string;
  };

  export default function pdfParse(
    data: Uint8Array | ArrayBuffer
  ): Promise<PdfParseResult>;
}

declare module 'pdf-parse/lib/pdf-parse' {
  type PdfParseResult = {
    text: string;
  };

  export default function pdfParse(
    data: Uint8Array | ArrayBuffer
  ): Promise<PdfParseResult>;
}
