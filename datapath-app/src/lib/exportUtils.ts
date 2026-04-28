import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

/**
 * Capture a DOM element and export as a branded PDF
 */
export const exportBrandedPDF = async (elementId: string, filename: string = 'Kimit_Report.pdf') => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id ${elementId} not found`);
    return;
  }

  try {
    const canvas = await html2canvas(element, { 
      scale: 2, 
      useCORS: true,
      backgroundColor: '#020617', // Match app background
      logging: false
    });
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    // Add Branded Header
    pdf.setFillColor(15, 23, 42); // slate-900
    pdf.rect(0, 0, pdfWidth, 20, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(14);
    pdf.text('KIMIT CLOUD - EXECUTIVE REPORT', 10, 13);
    
    // Add Main Content
    pdf.addImage(imgData, 'PNG', 0, 25, pdfWidth, pdfHeight);
    
    // Add Footer
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(`Generated on ${new Date().toLocaleString()} | kimit.cloud`, 10, 290);

    pdf.save(filename);
  } catch (error) {
    console.error('Error exporting PDF:', error);
  }
};

/**
 * Export data to a professional Excel file
 */
export const exportToExcel = (data: any[], filename: string = 'Kimit_Data.xlsx') => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Analytics');
  
  // Custom styling would go here (limited in standard xlsx)
  
  XLSX.writeFile(workbook, filename);
};
