using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.Drawing.Printing;
using System.IO;
using System.Net.WebSockets;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using PDFtoImage;
using SkiaSharp;
using System.Windows.Forms;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;

namespace SimplePrintAgent;

public class SimplePrintAgent
{
    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern bool AllowSetForegroundWindow(int dwProcessId);

    [DllImport("user32.dll")]
    private static extern bool BringWindowToTop(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    private static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    private static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);

    [DllImport("kernel32.dll")]
    private static extern uint GetCurrentThreadId();

    [DllImport("kernel32.dll")]
    private static extern int GetCurrentProcessId();

    private const int SW_SHOW = 5;
    private const int SW_RESTORE = 9;
    private const byte VK_MENU = 0x12; // Alt key
    private const uint KEYEVENTF_EXTENDEDKEY = 0x0001;
    private const uint KEYEVENTF_KEYUP = 0x0002;

    /// <summary>
    /// Force a window to the foreground even from a background process.
    /// </summary>
    private static void ForceForeground(IntPtr hWnd)
    {
        // Get the foreground window's thread
        IntPtr foreWnd = GetForegroundWindow();
        GetWindowThreadProcessId(foreWnd, out _);
        uint foreThread = GetWindowThreadProcessId(foreWnd, out _);
        uint appThread = GetCurrentThreadId();

        // Attach to the foreground thread
        if (foreThread != appThread)
        {
            AttachThreadInput(foreThread, appThread, true);
        }

        // Simulate Alt key press - this unlocks SetForegroundWindow
        keybd_event(VK_MENU, 0, KEYEVENTF_EXTENDEDKEY, UIntPtr.Zero);
        keybd_event(VK_MENU, 0, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, UIntPtr.Zero);

        ShowWindow(hWnd, SW_RESTORE);
        BringWindowToTop(hWnd);
        SetForegroundWindow(hWnd);

        // Detach
        if (foreThread != appThread)
        {
            AttachThreadInput(foreThread, appThread, false);
        }
    }

    private static readonly string BaseFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "GuacamoleFiles");
    private static readonly string TempFolder = Path.Combine(Path.GetTempPath(), "GuacamolePrint");
    private static readonly string LogFile = Path.Combine(TempFolder, "error.log");

    /// <summary>
    /// Make an incoming name safe for the file system. RDP print jobs carry the document title as filename;
    /// apps printing from an embedded browser (e.g. Nebim) send "about:blank", which on NTFS becomes
    /// a 0-byte "about" file with the data hidden in an alternate stream.
    /// </summary>
    private static string SanitizeFileName(string? name, bool isPDF)
    {
        name = (name ?? "").Trim();
        if (name.Length == 0 || name.StartsWith("about:", StringComparison.OrdinalIgnoreCase))
            name = $"Belge-{DateTime.Now:yyyyMMdd-HHmmss}";

        var invalid = Path.GetInvalidFileNameChars();
        var sb = new System.Text.StringBuilder(name.Length);
        foreach (var c in name) sb.Append(Array.IndexOf(invalid, c) >= 0 ? '_' : c);
        name = sb.ToString().Trim(' ', '.');
        if (name.Length == 0) name = $"Belge-{DateTime.Now:yyyyMMdd-HHmmss}";
        if (name.Length > 150) name = name.Substring(0, 150);

        if (isPDF && !name.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase)) name += ".pdf";
        return name;
    }

    // Upper bound for page render DPI. 1200 DPI A4 = ~140M px (>500 MB per bitmap) -> out of memory / driver failure
    private const int MaxRenderDpi = 600;

    /// <summary>
    /// Show print failure to the user (otherwise errors only land in error.log and the print silently disappears).
    /// </summary>
    private static void ShowPrintError(string fileName, string? printerName, Exception ex)
    {
        try
        {
            var msg = "Yazdırma başarısız oldu.\n\n"
                + $"Dosya: {fileName}\n"
                + $"Yazıcı: {printerName ?? "(seçilmedi)"}\n"
                + $"Hata: {ex.Message}\n\n"
                + $"Ayrıntılar: {LogFile}";
            MessageBox.Show(msg, "Guacamole Print Agent", MessageBoxButtons.OK, MessageBoxIcon.Error,
                MessageBoxDefaultButton.Button1, MessageBoxOptions.DefaultDesktopOnly);
        }
        catch { }
    }

    private static void LogError(string message, Exception? ex = null)
    {
        try
        {
            var logMessage = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {message}";
            if (ex != null) logMessage += $"\n  Exception: {ex.Message}\n  Stack: {ex.StackTrace}";
            File.AppendAllText(LogFile, logMessage + "\n\n");
            Console.WriteLine(logMessage);
        }
        catch { }
    }

    /// <summary>
    /// Convert SKBitmap directly to GDI+ Bitmap without PNG intermediate encoding.
    /// Sets DPI metadata so DrawImage scales correctly for crisp print output.
    /// </summary>
    private static Bitmap ConvertToBitmap(SKBitmap skBitmap, int dpi)
    {
        var bitmap = new Bitmap(skBitmap.Width, skBitmap.Height, PixelFormat.Format32bppPArgb);
        bitmap.SetResolution(dpi, dpi);

        var bmpData = bitmap.LockBits(
            new Rectangle(0, 0, skBitmap.Width, skBitmap.Height),
            ImageLockMode.WriteOnly,
            PixelFormat.Format32bppPArgb);

        IntPtr srcPtr = skBitmap.GetPixels();
        int srcStride = skBitmap.RowBytes;
        int dstStride = bmpData.Stride;
        int copyBytes = skBitmap.Width * 4;
        byte[] rowBuf = new byte[copyBytes];

        for (int y = 0; y < skBitmap.Height; y++)
        {
            Marshal.Copy(IntPtr.Add(srcPtr, y * srcStride), rowBuf, 0, copyBytes);
            Marshal.Copy(rowBuf, 0, IntPtr.Add(bmpData.Scan0, y * dstStride), copyBytes);
        }

        bitmap.UnlockBits(bmpData);
        return bitmap;
    }

    /// <summary>
    /// Finds TEXT content width for receipt printing.
    /// Uses dark threshold (only real text, ignores gray bg) + fill-ratio to skip lines/borders.
    /// Only TEXT rows (fill ratio &lt; 50%) determine the width.
    /// </summary>
    private static Rectangle FindContentBounds(SKBitmap skBitmap, byte threshold = 240)
    {
        IntPtr ptr = skBitmap.GetPixels();
        int rowBytes = skBitmap.RowBytes;
        int width = skBitmap.Width;
        int height = skBitmap.Height;
        byte[] row = new byte[width * 4];

        // Pass 1: top/bottom (any non-white)
        int contentTop = -1, contentBottom = 0;
        for (int y = 0; y < height; y++)
        {
            Marshal.Copy(IntPtr.Add(ptr, y * rowBytes), row, 0, width * 4);
            for (int x = 0; x < width; x++)
            {
                byte b = row[x * 4], g = row[x * 4 + 1], r = row[x * 4 + 2];
                if (r < threshold || g < threshold || b < threshold)
                {
                    if (contentTop < 0) contentTop = y;
                    contentBottom = y;
                    break;
                }
            }
        }

        if (contentTop < 0) return new Rectangle(0, 0, width, height);

        // Pass 2: left/right from MIDDLE 60% only (skips logo at top, barcode at bottom)
        // Threshold 180: catches anti-aliased text edges at 72 DPI, still ignores gray bg (~230)
        byte darkThreshold = 180;
        int left = width, right = 0;
        int textRows = 0, skippedRows = 0;
        int scanTop = contentTop + (int)((contentBottom - contentTop) * 0.15);
        int scanBot = contentTop + (int)((contentBottom - contentTop) * 0.80);

        for (int y = scanTop; y <= scanBot; y++)
        {
            Marshal.Copy(IntPtr.Add(ptr, y * rowBytes), row, 0, width * 4);

            int rowLeft = width, rowRight = 0, darkCount = 0;
            for (int x = 0; x < width; x++)
            {
                byte b = row[x * 4], g = row[x * 4 + 1], r = row[x * 4 + 2];
                if (r < darkThreshold || g < darkThreshold || b < darkThreshold)
                {
                    darkCount++;
                    if (x < rowLeft) rowLeft = x;
                    if (x > rowRight) rowRight = x;
                }
            }

            if (rowRight <= rowLeft || darkCount < 3) continue;

            int span = rowRight - rowLeft;
            float fillRatio = (float)darkCount / span;

            // High fill = solid line/border → skip (text at 72 DPI has 60-80% fill, lines have 95%+)
            if (fillRatio > 0.90f)
            {
                skippedRows++;
                continue;
            }

            // This is a TEXT row → use its edges
            textRows++;
            if (rowLeft < left) left = rowLeft;
            if (rowRight > right) right = rowRight;
        }

        var scanMsg = $"darkThresh={darkThreshold}, textRows={textRows}, skipped={skippedRows}, left={left}, right={right}, scanY={scanTop}-{scanBot} (page: {width}x{height})";
        Console.WriteLine($"\U0001f50d {scanMsg}");
        try { File.AppendAllText(Path.Combine(Path.GetTempPath(), "GuacamolePrint", "debug.log"), $"[{DateTime.Now:HH:mm:ss}] FindContentBounds: {scanMsg}\n"); } catch { }

        if (right <= left) return new Rectangle(0, 0, width, height);

        // Add 2% padding each side for breathing room
        int pad = (int)(width * 0.02);
        left = Math.Max(0, left - pad);
        right = Math.Min(width - 1, right + pad);

        return new Rectangle(left, contentTop, right - left + 1, contentBottom - contentTop + 1);
    }

    // Agent version from AssemblyVersion (csproj) - reported to browser for update checks
    private static readonly string AgentVersion = typeof(SimplePrintAgent).Assembly.GetName().Version?.ToString() ?? "0.0.0.0";

    public static async Task Main(string[] args)
    {
        Console.WriteLine("🚀 Starting Simple Guacamole Print Agent...");

        // Allow this process to set foreground windows
        AllowSetForegroundWindow(GetCurrentProcessId());

        // Ensure temp folder exists
        Directory.CreateDirectory(TempFolder);

        // Initialize Windows Forms for dialogs (must run on STA thread)
        Application.SetHighDpiMode(HighDpiMode.SystemAware);
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);

        var builder = WebApplication.CreateBuilder(args);
        builder.Logging.ClearProviders();
        builder.Logging.AddConsole();

        var app = builder.Build();
        app.UseWebSockets();

        app.Map("/ws", async context =>
        {
            if (context.WebSockets.IsWebSocketRequest)
            {
                using var webSocket = await context.WebSockets.AcceptWebSocketAsync();
                Console.WriteLine("✅ WebSocket connection established");

                await HandleWebSocket(webSocket);
            }
            else
            {
                context.Response.StatusCode = 400;
            }
        });

        app.MapGet("/health", (HttpContext context) => {
            return Results.Json(new { status = "healthy", version = AgentVersion, timestamp = DateTime.UtcNow });
        });

        Console.WriteLine("📡 Starting server on port 8181...");
        await app.RunAsync("http://localhost:8181");
    }
    
    private static async Task HandleWebSocket(WebSocket webSocket)
    {
        // Send welcome message
        var welcome = new
        {
            messageId = Guid.NewGuid().ToString(),
            type = "connection_established",
            timestamp = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ"),
            data = new
            {
                connectionId = Guid.NewGuid().ToString(),
                serverVersion = AgentVersion,
                supportedActions = new[] { "print", "download", "open", "prompt" }
            }
        };

        await SendMessage(webSocket, welcome);

        while (webSocket.State == WebSocketState.Open)
        {
            try
            {
                // Use MemoryStream to accumulate fragmented messages
                using var ms = new MemoryStream();
                var buffer = new byte[64 * 1024]; // 64KB chunks
                WebSocketReceiveResult result;

                do
                {
                    result = await webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        Console.WriteLine("❌ WebSocket connection closed");
                        return;
                    }
                    ms.Write(buffer, 0, result.Count);
                } while (!result.EndOfMessage);

                if (result.MessageType == WebSocketMessageType.Text)
                {
                    var messageBytes = ms.ToArray();
                    var message = Encoding.UTF8.GetString(messageBytes);
                    Console.WriteLine($"📨 Received message: {message.Length} bytes");
                    Console.WriteLine($"📨 First 200 chars: {message.Substring(0, Math.Min(200, message.Length))}");

                    try
                    {
                        dynamic? msg = JsonConvert.DeserializeObject(message);
                        string? msgType = msg?.type?.ToString();
                        Console.WriteLine($"📨 Message type: {msgType}");

                        if (msgType == "file_transfer" && msg != null)
                        {
                            Console.WriteLine("📄 Processing file_transfer...");
                            await HandleFileTransfer(webSocket, msg);
                        }
                        else if (msgType == "ping")
                        {
                            // Heartbeat - respond silently
                            await SendMessage(webSocket, new { type = "pong" });
                        }
                        else if (msgType == "status_query" && msg != null)
                        {
                            await HandleStatusQuery(webSocket, msg);
                        }
                        else
                        {
                            Console.WriteLine($"⚠️ Unknown message type: {msgType}");
                        }
                    }
                    catch (Exception parseEx)
                    {
                        Console.WriteLine($"❌ JSON parse error: {parseEx.Message}");
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ WebSocket error: {ex.Message}");
                break;
            }
        }
    }
    
    private static async Task HandleFileTransfer(WebSocket webSocket, dynamic message)
    {
        try
        {
            var fileName = (string)message.file.name;
            var fileContent = (string)message.file.content;
            var fileType = (string?)message.file.type ?? "application/octet-stream";
            var userName = (string?)message.metadata?.userName ?? "default";
            var isPDF = (bool?)message.metadata?.isPDF ?? fileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase);
            var originalFileName = fileName;
            fileName = SanitizeFileName(fileName, isPDF);

            Console.WriteLine($"📁 Received file: {fileName} (original: {originalFileName}) from user {userName} (type: {fileType}, isPDF: {isPDF})");
            try { File.AppendAllText(Path.Combine(TempFolder, "debug.log"), $"[{DateTime.Now:HH:mm:ss}] Received: '{originalFileName}' -> '{fileName}' type={fileType} isPDF={isPDF}\n"); } catch { }

            // Create per-user folder
            var userFolder = Path.Combine(BaseFolder, userName);
            Directory.CreateDirectory(userFolder);
            Directory.CreateDirectory(TempFolder);

            // Decode base64 content (remove data URL prefix if present)
            string base64Data = fileContent;
            if (base64Data.Contains(","))
            {
                base64Data = base64Data.Split(',')[1];
            }

            byte[] fileBytes = Convert.FromBase64String(base64Data);
            Console.WriteLine($"📄 Decoded file: {fileBytes.Length} bytes");

            // Save to temp file
            string tempFilePath = Path.Combine(TempFolder, fileName);
            await File.WriteAllBytesAsync(tempFilePath, fileBytes);
            Console.WriteLine($"💾 Temp saved to: {tempFilePath}");

            // Default save path in user folder
            string defaultSavePath = Path.Combine(userFolder, fileName);

            // Execute action based on file type
            string actionResult = "cancelled";
            string resultPath = tempFilePath;

            // Check if this is a receipt/invoice (filename contains "Invoice")
            bool isReceipt = isPDF && fileName.Contains("Invoice", StringComparison.OrdinalIgnoreCase);

            if (isReceipt)
            {
                // Receipt mode: only PrintDialog, no sizing dialog
                Console.WriteLine("\U0001f9fe Receipt detected (Invoice) - showing printer selection only...");

                var dialogThread = new Thread(() =>
                {
                  string? selectedPrinter = null;
                  try
                  {
                    int pageCount = Conversion.GetPageCount(fileBytes);
                    Console.WriteLine($"\U0001f4c4 Receipt PDF has {pageCount} page(s)");

                    // Read receipt width from config (default 80mm)
                    int receiptWidthMm = 80;
                    try
                    {
                        var configPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "appsettings.json");
                        if (File.Exists(configPath))
                        {
                            dynamic? cfg = JsonConvert.DeserializeObject(File.ReadAllText(configPath));
                            receiptWidthMm = (int?)cfg?.AppSettings?.Receipt?.WidthMm ?? 80;
                        }
                    }
                    catch { }
                    Console.WriteLine($"\U0001f4cf Receipt width: {receiptWidthMm}mm");

                    // Detect content bounds at 72 DPI - rotate to portrait FIRST
                    var infoBmp = Conversion.ToImage(fileBytes, 0, null, new RenderOptions(Dpi: 72));
                    bool pdfIsLandscape = infoBmp.Width > infoBmp.Height;
                    SKBitmap detectBmp;
                    if (pdfIsLandscape)
                    {
                        detectBmp = new SKBitmap(infoBmp.Height, infoBmp.Width);
                        using var rc = new SKCanvas(detectBmp);
                        rc.Translate(detectBmp.Width, 0);
                        rc.RotateDegrees(90);
                        rc.DrawBitmap(infoBmp, 0, 0);
                        infoBmp.Dispose();
                    }
                    else
                        detectBmp = infoBmp;

                    var contentRect = FindContentBounds(detectBmp);
                    int cropLeft = contentRect.X;
                    int cropWidth = contentRect.Width;
                    // Paper height from CROPPED aspect + 50mm bottom margin for cut-off
                    float croppedAspect = (float)detectBmp.Height / cropWidth;
                    int bottomMarginMm = 40;
                    int receiptHeightMm = (int)Math.Ceiling(receiptWidthMm * croppedAspect) + bottomMarginMm;
                    var debugMsg = $"Receipt: {receiptWidthMm}x{receiptHeightMm}mm, cropX={cropLeft} cropW={cropWidth} contentRect=({contentRect.X},{contentRect.Y},{contentRect.Width},{contentRect.Height}) portrait={detectBmp.Width}x{detectBmp.Height} landscape={pdfIsLandscape}";
                    Console.WriteLine($"\U0001f4cf {debugMsg}");
                    File.AppendAllText(Path.Combine(Path.GetTempPath(), "GuacamolePrint", "debug.log"), $"[{DateTime.Now:HH:mm:ss}] {debugMsg}\n");
                    // Thermal printers are 203-300 DPI; MaxRenderDpi keeps text sharp without huge bitmaps
                    int renderDpi = MaxRenderDpi;
                    float detectScale = renderDpi / 72f;
                    detectBmp.Dispose();

                    // Paper size in hundredths of inch
                    int psW = (int)(receiptWidthMm / 25.4 * 100);
                    int psH = (int)(receiptHeightMm / 25.4 * 100);

                    // Set up PrintDocument
                    int currentPage = 0;
                    var printDoc = new PrintDocument();
                    printDoc.DocumentName = fileName;
                    printDoc.DefaultPageSettings.PaperSize = new PaperSize("Receipt", psW, psH);
                    printDoc.DefaultPageSettings.Landscape = false;
                    printDoc.DefaultPageSettings.Margins = new Margins(0, 0, 0, 0);

                    printDoc.PrintPage += (sender, e) =>
                    {
                        var clip = e.Graphics!.VisibleClipBounds;

                        // Render full page at high DPI for sharp text
                        var opts = new RenderOptions(Dpi: renderDpi);
                        using var skFull = Conversion.ToImage(fileBytes, currentPage, null, opts);

                        // If landscape, rotate
                        SKBitmap skPage;
                        if (pdfIsLandscape)
                        {
                            skPage = new SKBitmap(skFull.Height, skFull.Width);
                            using var canvas = new SKCanvas(skPage);
                            canvas.Translate(skPage.Width, 0);
                            canvas.RotateDegrees(90);
                            canvas.DrawBitmap(skFull, 0, 0);
                        }
                        else
                            skPage = skFull;

                        // Crop only LEFT/RIGHT (keep full page height)
                        int cx = (int)(cropLeft * detectScale);
                        int cw = (int)(cropWidth * detectScale);
                        int ch = skPage.Height;
                        if (cx + cw > skPage.Width) cw = skPage.Width - cx;

                        using var skCropped = new SKBitmap(cw, ch);
                        using (var cropCanvas = new SKCanvas(skCropped))
                        {
                            cropCanvas.Clear(SKColors.White);
                            cropCanvas.DrawBitmap(skPage, new SKRect(cx, 0, cx + cw, ch), new SKRect(0, 0, cw, ch));
                        }
                        if (pdfIsLandscape) skPage.Dispose();

                        using var img = ConvertToBitmap(skCropped, renderDpi);

                        e.Graphics.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                        e.Graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.HighQuality;
                        e.Graphics.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.HighQuality;
                        e.Graphics.CompositingQuality = System.Drawing.Drawing2D.CompositingQuality.HighQuality;

                        // Fit to receipt width, center horizontally
                        float scale = clip.Width / (float)img.Width;
                        float w = clip.Width;
                        float h = img.Height * scale;
                        float x = clip.X + (clip.Width - w) / 2f;
                        e.Graphics.DrawImage(img, x, clip.Y, w, h);

                        // Force thermal printer paper feed: draw light gray line at bottom margin
                        // Thermal printers skip trailing white space - a visible mark forces paper advance
                        float marginY = clip.Y + h + (float)(bottomMarginMm / 25.4 * 100);
                        using var feedPen = new Pen(Color.FromArgb(230, 230, 230), 0.5f);
                        e.Graphics.DrawLine(feedPen, clip.X, marginY, clip.X + clip.Width, marginY);

                        var printMsg = $"PrintPage: clip=({clip.X},{clip.Y},{clip.Width},{clip.Height}) img={img.Width}x{img.Height} scale={scale:F4} drawn=({x},{clip.Y},{w},{h}) feedLineY={marginY}";
                        Console.WriteLine($"\U0001f4cf {printMsg}");
                        try { File.AppendAllText(Path.Combine(Path.GetTempPath(), "GuacamolePrint", "debug.log"), $"[{DateTime.Now:HH:mm:ss}] {printMsg}\n"); } catch { }

                        currentPage++;
                        e.HasMorePages = currentPage < pageCount;
                    };

                    // Show only PrintDialog (every time - no saving printer)
                    using var ownerForm = new Form
                    {
                        Width = 1, Height = 1,
                        StartPosition = FormStartPosition.CenterScreen,
                        ShowInTaskbar = false,
                        FormBorderStyle = FormBorderStyle.None,
                        Opacity = 0,
                        TopMost = true
                    };
                    ownerForm.Show();
                    ForceForeground(ownerForm.Handle);

                    using var printDialog = new PrintDialog();
                    printDialog.Document = printDoc;
                    printDialog.UseEXDialog = true;

                    if (printDialog.ShowDialog(ownerForm) == DialogResult.OK)
                    {
                        selectedPrinter = printDoc.PrinterSettings.PrinterName;
                        printDoc.Print();
                        actionResult = "receipt_printed";
                        Console.WriteLine($"\u2705 Receipt sent to printer: {printDoc.PrinterSettings.PrinterName}");
                    }
                    else
                    {
                        actionResult = "cancelled";
                        Console.WriteLine("\u274c Receipt print cancelled");
                    }
                    ownerForm.Close();
                  }
                  catch (Exception dialogEx)
                  {
                    Console.WriteLine($"\u274c Receipt print error: {dialogEx.Message}");
                    LogError($"Receipt print error (printer: {selectedPrinter})", dialogEx);
                    actionResult = "error";
                    ShowPrintError(fileName, selectedPrinter, dialogEx);
                  }
                });

                dialogThread.SetApartmentState(ApartmentState.STA);
                dialogThread.Start();
                dialogThread.Join();
            }
            // For PDF files: render and show Windows print dialog
            else if (isPDF)
            {
                Console.WriteLine("🖨️ PDF detected - showing print dialog...");

                var dialogThread = new Thread(() =>
                {
                  string? selectedPrinter = null;
                  try
                  {
                    // Get page count (fast, no rendering)
                    int pageCount = Conversion.GetPageCount(fileBytes);
                    Console.WriteLine($"📄 PDF has {pageCount} page(s)");

                    // Render first page for preview
                    Console.WriteLine("📐 Rendering preview...");
                    var prevOpts = new RenderOptions(Dpi: 96);
                    using var prevBmp = Conversion.ToImage(fileBytes, 0, null, prevOpts);
                    using var prevData = prevBmp.Encode(SKEncodedImageFormat.Png, 85);
                    var prevMs = new MemoryStream(prevData.ToArray());
                    var prevImg = Image.FromStream(prevMs);
                    Console.WriteLine($"📐 Preview rendered: {prevImg.Width}x{prevImg.Height}");

                    // Scale state
                    string scaleMode = "fit";
                    int customPct = 100;

                    // --- Main dialog: sizing + preview ---
                    int leftW = 300, prevW = 440, formH = 360;
                    using var mainForm = new Form
                    {
                        Text = $"Yazd\u0131rma",
                        ClientSize = new Size(leftW + prevW + 20, formH),
                        StartPosition = FormStartPosition.CenterScreen,
                        FormBorderStyle = FormBorderStyle.FixedDialog,
                        MaximizeBox = false,
                        MinimizeBox = false,
                        TopMost = true,
                        ShowInTaskbar = true
                    };

                    // === Left panel: scale only ===
                    var lblScale = new Label { Text = "\u00d6l\u00e7eklendirme:", Location = new Point(20, 15), AutoSize = true, Font = new Font("Segoe UI", 12, FontStyle.Bold) };
                    var rbFit = new RadioButton { Text = "Sayfaya S\u0131\u011fd\u0131r", Location = new Point(30, 50), Size = new Size(250, 30), Checked = true, Font = new Font("Segoe UI", 10) };
                    var rbActual = new RadioButton { Text = "Ger\u00e7ek Boyut (100%)", Location = new Point(30, 82), Size = new Size(250, 30), Font = new Font("Segoe UI", 10) };
                    var rbCustom = new RadioButton { Text = "\u00d6zel:", Location = new Point(30, 114), Size = new Size(70, 30), Font = new Font("Segoe UI", 10) };
                    var nudPct = new NumericUpDown { Location = new Point(105, 116), Size = new Size(75, 28), Minimum = 25, Maximum = 400, Value = 100, Increment = 10, Font = new Font("Segoe UI", 10) };
                    var lblPct = new Label { Text = "%", Location = new Point(184, 120), AutoSize = true, Font = new Font("Segoe UI", 10) };

                    // Paper size: fixed A4
                    float pageW = 210f, pageH = 297f;
                    var lblPage = new Label { Text = "Ka\u011f\u0131t: A4 (210 x 297 mm)", Location = new Point(20, 155), AutoSize = true, Font = new Font("Segoe UI", 10) };

                    // Hidden margin values (fixed 6mm defaults)
                    var nudTopM = new NumericUpDown { Value = 6, Visible = false };
                    var nudBotM = new NumericUpDown { Value = 6, Visible = false };
                    var nudLeftM = new NumericUpDown { Value = 6, Visible = false };
                    var nudRightM = new NumericUpDown { Value = 6, Visible = false };

                    // === Right panel: preview ===
                    var lblPrev = new Label { Text = "\u00d6nizleme:", Location = new Point(leftW + 5, 15), AutoSize = true, Font = new Font("Segoe UI", 12, FontStyle.Bold) };
                    var prevPanel = new Panel { Location = new Point(leftW + 5, 45), Size = new Size(prevW - 5, formH - 70), BorderStyle = BorderStyle.FixedSingle, BackColor = Color.FromArgb(230, 230, 230) };

                    prevPanel.Paint += (s, ev) =>
                    {
                        var g = ev.Graphics;
                        g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.HighQuality;
                        g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;

                        float a4R = pageH / pageW;
                        int pad = 12;
                        int aw = prevPanel.Width - 2 * pad, ah = prevPanel.Height - 2 * pad;
                        int pw, ph;
                        if (ah / (float)aw > a4R) { pw = aw; ph = (int)(aw * a4R); }
                        else { ph = ah; pw = (int)(ah / a4R); }
                        int px = (prevPanel.Width - pw) / 2, py = (prevPanel.Height - ph) / 2;

                        g.FillRectangle(Brushes.DarkGray, px + 4, py + 4, pw, ph);
                        g.FillRectangle(Brushes.White, px, py, pw, ph);
                        g.DrawRectangle(Pens.Gray, px, py, pw, ph);

                        if (prevImg == null) return;

                        // Dynamic margins from controls (mm to paper pixels)
                        float mxL = pw * (float)nudLeftM.Value / pageW;
                        float mxR = pw * (float)nudRightM.Value / pageW;
                        float myT = ph * (float)nudTopM.Value / pageH;
                        float myB = ph * (float)nudBotM.Value / pageH;
                        float cw = pw - mxL - mxR;
                        float ch = ph - myT - myB;

                        float iw, ih;
                        if (rbFit.Checked)
                        {
                            float sc = Math.Min(cw / prevImg.Width, ch / prevImg.Height);
                            iw = prevImg.Width * sc; ih = prevImg.Height * sc;
                        }
                        else
                        {
                            float nw = prevImg.Width / 96f / (pageW / 25.4f);
                            float nh = prevImg.Height / 96f / (pageH / 25.4f);
                            if (rbCustom.Checked) { float cs = (float)nudPct.Value / 100f; nw *= cs; nh *= cs; }
                            iw = pw * nw; ih = ph * nh;
                            // No clamping - allow overflow for scale > 100%
                        }

                        float ix = px + mxL + (cw - iw) / 2f, iy = py + myT + (ch - ih) / 2f;

                        // Clip to paper bounds so overflow is cropped, then restore
                        var gState = g.Save();
                        g.IntersectClip(new RectangleF(px + 1, py + 1, pw - 2, ph - 2));
                        g.DrawImage(prevImg, ix, iy, iw, ih);
                        g.Restore(gState);

                        // Draw margin lines (always visible)
                        using var dp = new Pen(Color.FromArgb(80, Color.Blue)) { DashStyle = System.Drawing.Drawing2D.DashStyle.Dash };
                        g.DrawRectangle(dp, px + mxL, py + myT, cw, ch);
                    };

                    // Update preview on change
                    rbFit.CheckedChanged += (s, ev) => prevPanel.Refresh();
                    rbActual.CheckedChanged += (s, ev) => prevPanel.Refresh();
                    rbCustom.CheckedChanged += (s, ev) => prevPanel.Refresh();
                    nudPct.Click += (s, ev) => rbCustom.Checked = true;
                    nudPct.ValueChanged += (s, ev) => { rbCustom.Checked = true; prevPanel.Refresh(); };

                    // Buttons
                    var btnPrint = new Button { Text = "Yazd\u0131r", Location = new Point(30, formH - 60), Size = new Size(120, 42), Font = new Font("Segoe UI", 11, FontStyle.Bold), BackColor = Color.FromArgb(0, 120, 215), ForeColor = Color.White, FlatStyle = FlatStyle.Flat };
                    var btnCancel = new Button { Text = "\u0130ptal", Location = new Point(165, formH - 60), Size = new Size(110, 42), Font = new Font("Segoe UI", 11) };
                    btnPrint.Click += (s, ev) => { mainForm.DialogResult = DialogResult.OK; };
                    btnCancel.Click += (s, ev) => { mainForm.DialogResult = DialogResult.Cancel; };

                    mainForm.Controls.AddRange(new Control[] { lblScale, rbFit, rbActual, rbCustom, nudPct, lblPct, lblPage, lblPrev, prevPanel, btnPrint, btnCancel });
                    mainForm.Shown += (s, ev) => { ForceForeground(mainForm.Handle); mainForm.TopMost = true; mainForm.BringToFront(); mainForm.Activate(); };
                    mainForm.FormClosed += (s, ev) => { prevImg?.Dispose(); prevMs?.Dispose(); };

                    Console.WriteLine("📐 Showing sizing dialog...");
                    var sizeResult = mainForm.ShowDialog();
                    Console.WriteLine($"📐 Result: {sizeResult}");

                    if (sizeResult != DialogResult.OK)
                    {
                        actionResult = "cancelled";
                        Console.WriteLine("❌ Cancelled");
                        return;
                    }

                    if (rbFit.Checked) scaleMode = "fit";
                    else if (rbActual.Checked) scaleMode = "actual";
                    else { scaleMode = "custom"; customPct = (int)nudPct.Value; }

                    // Read margin values (mm to hundredths of inch)
                    int mL = (int)((double)nudLeftM.Value * 100.0 / 25.4);
                    int mR = (int)((double)nudRightM.Value * 100.0 / 25.4);
                    int mT = (int)((double)nudTopM.Value * 100.0 / 25.4);
                    int mB = (int)((double)nudBotM.Value * 100.0 / 25.4);
                    // A4 paper size (mm to hundredths of inch)
                    int psW = (int)(pageW / 25.4 * 100);
                    int psH = (int)(pageH / 25.4 * 100);
                    Console.WriteLine($"📐 Mode: {scaleMode} {(scaleMode == "custom" ? customPct + "%" : "")}, Paper: A4, Margins: L={nudLeftM.Value}mm R={nudRightM.Value}mm T={nudTopM.Value}mm B={nudBotM.Value}mm");

                    // Set up PrintDocument
                    int currentPage = 0;
                    var printDoc = new PrintDocument();
                    printDoc.DocumentName = fileName;
                    printDoc.DefaultPageSettings.Margins = new Margins(mL, mR, mT, mB);
                    printDoc.DefaultPageSettings.PaperSize = new PaperSize("A4", psW, psH);
                    printDoc.DefaultPageSettings.Landscape = false;

                    printDoc.PrintPage += (sender, e) =>
                    {
                        var bounds = e.MarginBounds;

                        // Render at printer's native DPI for 1:1 pixel mapping, capped to avoid out-of-memory on 1200 DPI printers
                        int renderDpi = Math.Clamp((int)e.Graphics!.DpiX, 300, MaxRenderDpi);
                        RenderOptions opts;
                        if (scaleMode == "fit")
                        {
                            int tPx = (int)(e.PageSettings.PaperSize.Width / 100f * renderDpi);
                            opts = new RenderOptions(Dpi: renderDpi, Width: tPx, WithAspectRatio: true);
                        }
                        else
                            opts = new RenderOptions(Dpi: renderDpi);

                        using var skBitmap = Conversion.ToImage(fileBytes, currentPage, null, opts);
                        using var img = ConvertToBitmap(skBitmap, renderDpi);
                        try { File.AppendAllText(Path.Combine(TempFolder, "debug.log"), $"[{DateTime.Now:HH:mm:ss}] PrintPage {currentPage + 1}/{pageCount}: printer={e.PageSettings.PrinterSettings.PrinterName} printerDpi={e.Graphics.DpiX} renderDpi={renderDpi} img={img.Width}x{img.Height} mode={scaleMode}\n"); } catch { }

                        // High quality rendering for crisp text
                        e.Graphics.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                        e.Graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.HighQuality;
                        e.Graphics.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.HighQuality;
                        e.Graphics.CompositingQuality = System.Drawing.Drawing2D.CompositingQuality.HighQuality;

                        float w, h;
                        if (scaleMode == "fit")
                        {
                            float s = Math.Min((float)bounds.Width / img.Width, (float)bounds.Height / img.Height);
                            w = img.Width * s; h = img.Height * s;
                        }
                        else
                        {
                            // At printer DPI: img pixels / renderDpi = inches, * 100 = hundredths
                            w = img.Width * 100f / renderDpi; h = img.Height * 100f / renderDpi;
                            if (scaleMode == "custom") { w *= customPct / 100f; h *= customPct / 100f; }
                            // No clamping - allow overflow for scale > 100% (printer crops naturally)
                        }

                        float x = bounds.X + (bounds.Width - w) / 2f;
                        float y = bounds.Y + (bounds.Height - h) / 2f;

                        // Draw with ImageAttributes for smooth edge handling
                        using var attrs = new System.Drawing.Imaging.ImageAttributes();
                        attrs.SetWrapMode(System.Drawing.Drawing2D.WrapMode.TileFlipXY);
                        e.Graphics.DrawImage(img,
                            new Rectangle((int)x, (int)y, (int)w, (int)h),
                            0, 0, img.Width, img.Height,
                            GraphicsUnit.Pixel, attrs);

                        currentPage++;
                        e.HasMorePages = currentPage < pageCount;
                    };

                    // Show printer selection
                    using var ownerForm = new Form
                    {
                        Width = 1, Height = 1,
                        StartPosition = FormStartPosition.CenterScreen,
                        ShowInTaskbar = false,
                        FormBorderStyle = FormBorderStyle.None,
                        Opacity = 0,
                        TopMost = true
                    };
                    ownerForm.Show();
                    ForceForeground(ownerForm.Handle);

                    using var printDialog = new PrintDialog();
                    printDialog.Document = printDoc;
                    printDialog.AllowSomePages = true;
                    printDialog.UseEXDialog = true;

                    if (printDialog.ShowDialog(ownerForm) == DialogResult.OK)
                    {
                        selectedPrinter = printDoc.PrinterSettings.PrinterName;

                        // Use the printer's own A4 entry instead of a custom 210x297 size:
                        // some drivers (e.g. Brother GDI) silently drop jobs with custom paper sizes
                        var nativeA4 = printDoc.PrinterSettings.PaperSizes.Cast<PaperSize>().FirstOrDefault(p => p.Kind == PaperKind.A4);
                        if (nativeA4 != null) printDoc.DefaultPageSettings.PaperSize = nativeA4;
                        try { File.AppendAllText(Path.Combine(TempFolder, "debug.log"), $"[{DateTime.Now:HH:mm:ss}] Printer={selectedPrinter} paper={printDoc.DefaultPageSettings.PaperSize.PaperName} kind={printDoc.DefaultPageSettings.PaperSize.Kind} nativeA4={(nativeA4 != null)}\n"); } catch { }

                        printDoc.Print();
                        actionResult = "printing";
                        Console.WriteLine("✅ Sent to printer");
                    }
                    else
                    {
                        actionResult = "cancelled";
                        Console.WriteLine("❌ Print cancelled");
                    }
                    ownerForm.Close();
                  }
                  catch (Exception dialogEx)
                  {
                    Console.WriteLine($"❌ Print error: {dialogEx.Message}");
                    LogError($"PDF print error (printer: {selectedPrinter})", dialogEx);
                    actionResult = "error";
                    ShowPrintError(fileName, selectedPrinter, dialogEx);
                  }
                });

                dialogThread.SetApartmentState(ApartmentState.STA);
                dialogThread.Start();
                dialogThread.Join();
            }
            else
            {
                // For non-PDF files: show Windows Save As dialog
                Console.WriteLine($"💾 Showing Save As dialog for {fileName}...");

                var dialogThread = new Thread(() =>
                {
                    try
                    {
                        string ext = Path.GetExtension(fileName).ToLower();
                        string filter = ext switch
                        {
                            ".xlsx" or ".xls" => "Excel Files (*.xlsx;*.xls)|*.xlsx;*.xls|All Files (*.*)|*.*",
                            ".docx" or ".doc" => "Word Files (*.docx;*.doc)|*.docx;*.doc|All Files (*.*)|*.*",
                            ".pptx" or ".ppt" => "PowerPoint Files (*.pptx;*.ppt)|*.pptx;*.ppt|All Files (*.*)|*.*",
                            ".txt" => "Text Files (*.txt)|*.txt|All Files (*.*)|*.*",
                            ".png" => "PNG Images (*.png)|*.png|All Files (*.*)|*.*",
                            ".jpg" or ".jpeg" => "JPEG Images (*.jpg;*.jpeg)|*.jpg;*.jpeg|All Files (*.*)|*.*",
                            ".zip" => "ZIP Archives (*.zip)|*.zip|All Files (*.*)|*.*",
                            _ => "All Files (*.*)|*.*"
                        };

                        using var ownerForm = new Form
                        {
                            Width = 1, Height = 1,
                            StartPosition = FormStartPosition.CenterScreen,
                            ShowInTaskbar = false,
                            FormBorderStyle = FormBorderStyle.None,
                            Opacity = 0,
                            TopMost = true
                        };
                        ownerForm.Show();
                        ForceForeground(ownerForm.Handle);

                        using var saveDialog = new SaveFileDialog
                        {
                            FileName = fileName,
                            InitialDirectory = Environment.GetFolderPath(Environment.SpecialFolder.Desktop),
                            Filter = filter,
                            Title = "Dosya Kaydet"
                        };

                        if (saveDialog.ShowDialog(ownerForm) == DialogResult.OK)
                        {
                            File.Copy(tempFilePath, saveDialog.FileName, true);
                            resultPath = saveDialog.FileName;
                            actionResult = "saved";
                            Console.WriteLine($"✅ File saved to: {saveDialog.FileName}");
                        }
                        else
                        {
                            actionResult = "cancelled";
                            Console.WriteLine("❌ Save cancelled by user");
                        }
                        ownerForm.Close();
                    }
                    catch (Exception dialogEx)
                    {
                        Console.WriteLine($"❌ Save dialog error: {dialogEx.Message}");
                        LogError("Save dialog error", dialogEx);
                        actionResult = "error";
                    }
                });

                dialogThread.SetApartmentState(ApartmentState.STA);
                dialogThread.Start();
                dialogThread.Join();
            }

            // Send response
            var response = new
            {
                messageId = (string)message.messageId,
                type = "response",
                status = "success",
                message = $"File '{fileName}' {actionResult}",
                data = new
                {
                    action = actionResult,
                    filePath = resultPath,
                    fileSize = fileBytes.Length
                }
            };

            await SendMessage(webSocket, response);
            Console.WriteLine($"✅ Action completed: {actionResult}");
        }
        catch (Exception ex)
        {
            LogError($"Error processing file transfer: {ex.Message}", ex);

            var errorResponse = new
            {
                messageId = (string)message.messageId,
                type = "error",
                message = $"Error: {ex.Message}"
            };

            await SendMessage(webSocket, errorResponse);
        }
    }

    private static (string? action, string? path) ShowFileDialog(string fileName, string tempPath, int fileSize, bool isPDF, string defaultSavePath)
    {
        // Note: This dialog is only shown for non-PDF files
        // PDFs are printed directly without showing this dialog

        using var form = new Form
        {
            Text = "Dosya Aktarimi",
            Size = new Size(350, 180),
            StartPosition = FormStartPosition.CenterScreen,
            FormBorderStyle = FormBorderStyle.FixedDialog,
            MaximizeBox = false,
            MinimizeBox = false,
            TopMost = true
        };

        // Format file size in Turkish
        string sizeText = fileSize < 1024 ? $"{fileSize} bayt" :
                         fileSize < 1048576 ? $"{fileSize / 1024.0:N1} KB" :
                         $"{fileSize / 1048576.0:N1} MB";

        var label = new Label
        {
            Text = $"Dosya: {fileName}\nBoyut: {sizeText}\n\nNe yapmak istiyorsunuz?",
            Location = new Point(20, 15),
            Size = new Size(300, 55),
            Font = new Font("Segoe UI", 10)
        };

        var btnSave = new Button
        {
            Text = "Kaydet",
            Location = new Point(20, 80),
            Size = new Size(90, 35),
            Font = new Font("Segoe UI", 9)
        };

        var btnOpen = new Button
        {
            Text = "Ac",
            Location = new Point(120, 80),
            Size = new Size(90, 35),
            Font = new Font("Segoe UI", 9)
        };

        var btnCancel = new Button
        {
            Text = "Iptal",
            Location = new Point(220, 80),
            Size = new Size(90, 35),
            Font = new Font("Segoe UI", 9)
        };

        string? action = null;
        string? savedPath = defaultSavePath; // Default to user folder

        btnOpen.Click += (s, e) => { action = "open"; form.Close(); };
        btnCancel.Click += (s, e) => { action = "cancel"; form.Close(); };

        btnSave.Click += (s, e) =>
        {
            // Get file extension for filter
            string ext = Path.GetExtension(fileName).ToLower();
            string filter = ext switch
            {
                ".pdf" => "PDF Files (*.pdf)|*.pdf|All Files (*.*)|*.*",
                ".xlsx" or ".xls" => "Excel Files (*.xlsx;*.xls)|*.xlsx;*.xls|All Files (*.*)|*.*",
                ".docx" or ".doc" => "Word Files (*.docx;*.doc)|*.docx;*.doc|All Files (*.*)|*.*",
                ".pptx" or ".ppt" => "PowerPoint Files (*.pptx;*.ppt)|*.pptx;*.ppt|All Files (*.*)|*.*",
                ".txt" => "Text Files (*.txt)|*.txt|All Files (*.*)|*.*",
                _ => "All Files (*.*)|*.*"
            };

            using var saveDialog = new SaveFileDialog
            {
                FileName = fileName,
                InitialDirectory = Path.GetDirectoryName(defaultSavePath),
                Filter = filter,
                Title = "Dosya Kaydet"
            };

            if (saveDialog.ShowDialog() == DialogResult.OK)
            {
                savedPath = saveDialog.FileName;
                action = "save";
                form.Close();
            }
        };

        // Add controls (no Print button - PDFs print directly)
        form.Controls.AddRange(new Control[] { label, btnSave, btnOpen, btnCancel });
        form.AcceptButton = btnSave;
        form.CancelButton = btnCancel;

        // Bring to front
        form.Shown += (s, e) =>
        {
            form.TopMost = true;
            form.BringToFront();
            form.Activate();
            ForceForeground(form.Handle);
        };

        Application.Run(form);
        return (action, savedPath);
    }
    
    private static async Task HandleStatusQuery(WebSocket webSocket, dynamic message)
    {
        var status = new
        {
            messageId = message.messageId,
            type = "status_response",
            timestamp = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ"),
            data = new
            {
                server = new
                {
                    version = AgentVersion,
                    uptime = 3600,
                    activeConnections = 1
                },
                system = new
                {
                    osVersion = Environment.OSVersion.ToString(),
                    machineName = Environment.MachineName,
                    processorCount = Environment.ProcessorCount
                },
                printers = new[] { "Default Printer", "Microsoft Print to PDF" }
            }
        };
        
        await SendMessage(webSocket, status);
    }
    
    private static async Task SendMessage(WebSocket webSocket, object message)
    {
        string json = JsonConvert.SerializeObject(message, Formatting.None);
        byte[] buffer = Encoding.UTF8.GetBytes(json);
        
        await webSocket.SendAsync(
            new ArraySegment<byte>(buffer),
            WebSocketMessageType.Text,
            true,
            CancellationToken.None);
    }
}