const Order = require('../../models/user/order')
const Coupon = require('../../models/user/coupon')
const {Parser} = require('json2csv');
const PDFDocument = require('pdfkit');
const fs = require('fs')
const ExcelJS = require('exceljs');
const XLSX = require('xlsx');





const salesReport = async (req, res) => {
  try {
    const { filter, startDate, endDate } = req.query;

    // Initialize start and end dates for filtering
    let start, end;
    const today = new Date();

    console.log('Filter:', filter); // Log the filter
    console.log('Start Date:', startDate); // Log start date
    console.log('End Date:', endDate); // Log end date

    // Initialize reportData to avoid "undefined" error
    let reportData = {
      totalOrders: 0,
      totalSales: 0,
      totaldiscount: 0,
      totalTax: 0,
      couponData: [],
      totalRevenue: 0,
      totalRefundAmount: 0,
      refundCount: 0,
    };

    if (filter === 'daily') {
      start = new Date(today.setHours(0, 0, 0, 0));
      end = new Date();
    } else if (filter === 'weekly') {
      const firstDayOfWeek = today.getDate() - today.getDay();
      start = new Date(today.setDate(firstDayOfWeek));
      start.setHours(0, 0, 0, 0);
      end = new Date();
    } else if (filter === 'monthly') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date();
    } else if (filter === 'custom' && startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // Include the entire end day
    } else {
      return res.render('admin/sales', { reportData, filter, startDate, endDate });
    }

    // Fetch all orders within the date range
    const orders = await Order.find({
      createdAt: { $gte: start, $lte: end },
    });

    console.log('Orders:', orders); // Log the orders to check

    // Calculating totals
    const totalOrders = orders.length;
    const totalSales = orders.reduce(
      (sum, order) => sum + (order.orderSummary?.total || 0),
      0
    );
    const totaldiscount = orders.reduce(
      (sum, order) => sum + (order.orderSummary?.couponDiscount || 0),
      0
    );
    const totalTax = orders.reduce(
      (sum, order) => sum + (order.orderSummary?.tax || 0),
      0
    );

    const refundOrders = orders.filter(
      (order) =>
        order.orderStatus &&
        ['CANCELLED', 'RETURN'].includes(order.orderStatus.toUpperCase())
    );

    console.log('Refund orders:', refundOrders);

    const refundCount = refundOrders.length;

    console.log('Refund count:', refundCount);

    const totalRefundAmount = refundOrders.reduce(
      (sum, order) => sum + (order.orderSummary?.total || 0),
      0
    );

    console.log('Total refund amount:', totalRefundAmount);

    const totalRevenue =
      totalSales - totaldiscount - totalRefundAmount + totalTax;

    console.log('Total Orders:', totalOrders);
    console.log('Total Sales:', totalSales);
    console.log('Total Discount:', totaldiscount);
    console.log('Total Tax:', totalTax);

    // Fetch coupon data: only code and discount fields
    const couponData = await Coupon.find({}, 'code');
    console.log('Coupon Data:', couponData);

    // Prepare data for EJS
    reportData = {
      totalOrders,
      totalSales,
      totaldiscount,
      totalTax,
      couponData,
      totalRevenue,
      totalRefundAmount,
      refundCount,
    };

    console.log('Report Data:', reportData);

    res.render('admin/sales', { reportData, filter, startDate, endDate });
  } catch (error) {
    console.error('Error fetching sales report:', error);
    res.status(500).send('Internal Server Error');
  }
};

  

// Function to download sales report as PDF and Excel
const downloadSalesReport = async (req, res) => {
  try {
    const { filter, startDate, endDate, format } = req.query;

    let start, end;
    const today = new Date();

    // Date range logic remains the same
    if (filter === 'daily') {
      start = new Date(today.setHours(0, 0, 0, 0));
      end = new Date();
    } else if (filter === 'weekly') {
      const firstDayOfWeek = today.getDate() - today.getDay();
      start = new Date(today.setDate(firstDayOfWeek));
      start.setHours(0, 0, 0, 0);
      end = new Date();
    } else if (filter === 'monthly') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date();
    } else if (filter === 'custom' && startDate && endDate) {
      // Try to parse the startDate and endDate, but don't fail completely if they are invalid
      start = new Date(startDate);
      end = new Date(endDate);
    
      // If the start date or end date is invalid (NaN), we try to make it valid by using the current date
      if (isNaN(start)) {
        start = new Date();  // Default to today if the start date is invalid
      }
      
      if (isNaN(end)) {
        end = new Date();  // Default to today if the end date is invalid
      }
    
      // Ensure the end date covers the full day
      end.setHours(23, 59, 59, 999);
    
    } else if (filter === 'custom') {
      // If no custom date range is provided, fall back to last 30 days
      const defaultStartDate = new Date();
      defaultStartDate.setDate(defaultStartDate.getDate() - 30); // 30 days ago
      start = defaultStartDate;
      end = new Date(); // Today's date
    
      end.setHours(23, 59, 59, 999); // Ensure the end date covers the entire day
    }
    
    else {
      return res.status(400).send('Invalid filter or date range.');
    }

    const orders = await Order.find({
      createdAt: { $gte: start, $lte: end },
    });

    // Helper function to truncate text
    const truncateText = (text, maxLength) => {
      if (text.length <= maxLength) return text;
      return text.substring(0, maxLength - 3) + '...';
    };

    if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      const fileName = `Sales_Report_${new Date().toISOString()}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
      doc.pipe(res);

      // Title and date range info
      doc.fontSize(20).text('Sales Report', { align: 'center' }).moveDown();

      const formattedStartDate = start ? start.toLocaleDateString() : 'N/A';
      const formattedEndDate = end ? end.toLocaleDateString() : 'N/A';
      doc.fontSize(12).text(`Filter: ${filter}`, { align: 'left' });
      doc.text(`Start Date: ${formattedStartDate}`);
      doc.text(`End Date: ${formattedEndDate}`).moveDown();

      // Updated column positions and widths
      const tableTop = doc.y + 20;
      const columns = {
        orderId: { x: 30, width: 150, maxChars: 20 },  // Limit Order ID length
        date: { x: 190, width: 80 },
        invoice: { x: 280, width: 80 },
        salesRep: { x: 370, width: 80 },
        total: { x: 460, width: 70 },
        paid: { x: 540, width: 40 }
      };

      // Header row
      doc.fontSize(10);
      Object.entries(columns).forEach(([key, col]) => {
        const headerText = {
          orderId: 'Order ID',
          date: 'Date',
          invoice: 'Invoice #',
          salesRep: 'Sales Rep',
          total: 'Total',
          paid: 'Paid'
        }[key];
        
        doc.text(headerText, col.x, tableTop, {
          width: col.width,
          align: key === 'total' ? 'right' : 'left'
        });
      });

      // Header line
      doc.moveTo(30, tableTop + 15)
         .lineTo(580, tableTop + 15)
         .stroke();

      // Table rows
      let yPosition = tableTop + 20;
      orders.forEach((order) => {
        const orderId = truncateText(order.orderId, columns.orderId.maxChars);
        const date = order.createdAt
          ? new Date(order.createdAt).toLocaleDateString()
          : 'N/A';
        const invoice = order.invoice || 'INV001';
        const salesRep = order.salesRep || 'Sales 1';
        const total = order.orderSummary?.total.toFixed(2) || '0.00';
        const paid = 'Yes';

        // Draw each cell in the row
        doc.text(orderId, columns.orderId.x, yPosition, { 
          width: columns.orderId.width,
          lineBreak: false
        })
        .text(date, columns.date.x, yPosition, { 
          width: columns.date.width,
          lineBreak: false
        })
        .text(invoice, columns.invoice.x, yPosition, { 
          width: columns.invoice.width,
          lineBreak: false
        })
        .text(salesRep, columns.salesRep.x, yPosition, { 
          width: columns.salesRep.width,
          lineBreak: false
        })
        .text(total, columns.total.x, yPosition, { 
          width: columns.total.width,
          align: 'right',
          lineBreak: false
        })
        .text(paid, columns.paid.x, yPosition, { 
          width: columns.paid.width,
          lineBreak: false
        });

        yPosition += 20;

        // Row separator line
        doc.moveTo(30, yPosition - 5)
           .lineTo(580, yPosition - 5)
           .stroke();
      });

      doc.end();
    } else if (format === 'excel') {
      // Excel generation code remains the same but with truncated Order IDs
      const excelData = orders.map((order) => ({
        OrderID: truncateText(order.orderId, 30), // Longer limit for Excel
        Date: order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A',
        Invoice: order.invoice || 'INV001',
        SalesRep: order.salesRep || 'Sales 1',
        Total: order.orderSummary?.total.toFixed(2) || '0.00',
        Paid: 'Yes',
      }));

      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sales Report');

      const fileName = `Sales_Report_${new Date().toISOString()}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

      const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
      res.end(buffer);
    } else {
      return res.status(400).send('Invalid format. Please specify "pdf" or "excel".');
    }
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).send('Internal server error.');
  }
};


module.exports = {
    salesReport,
    downloadSalesReport
}