import PDFViewer from '@/components/PDFViewer';

export default function ReadPage() {
    // This assumes you saved the file at public/uploads/sample.pdf
    const pdfPath = '/uploads/books/1783557303810-_OceanofPDF.com_Recursion_-_Blake_Crouch.pdf';

    return (
        <main>
            <PDFViewer fileUrl={pdfPath} />
        </main>
    );
}