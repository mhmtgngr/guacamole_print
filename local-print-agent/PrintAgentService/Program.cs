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
            return Results.Json(new { status = "healthy", timestamp = DateTime.UtcNow });
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
                serverVersion = "1.0.0-simple",
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

            Console.WriteLine($"📁 Received file: {fileName} from user {userName} (type: {fileType}, isPDF: {isPDF})");

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

            // For PDF files: render and show Windows print dialog
            if (isPDF)
            {
                Console.WriteLine("🖨️ PDF detected - showing print dialog...");

                var dialogThread = new Thread(() =>
                {
                  try
                  {
                    // Get page count (fast, no rendering)
                    int pageCount = Conversion.GetPageCount(fileBytes);
                    Console.WriteLine($"📄 PDF has {pageCount} page(s)");

                    // Set up PrintDocument - render pages on demand during printing
                    int currentPage = 0;
                    var printDoc = new PrintDocument();
                    printDoc.DocumentName = fileName;

                    printDoc.PrintPage += (sender, e) =>
                    {
                        // Render at print time with high DPI
                        var opts = new RenderOptions(Dpi: 300);
                        using var skBitmap = Conversion.ToImage(fileBytes, currentPage, null, opts);
                        using var skData = skBitmap.Encode(SKEncodedImageFormat.Png, 100);
                        using var ms = new MemoryStream(skData.ToArray());
                        using var img = Image.FromStream(ms);

                        // Scale image to fit page margins
                        var bounds = e.MarginBounds;
                        float scale = Math.Min(
                            (float)bounds.Width / img.Width,
                            (float)bounds.Height / img.Height);
                        int w = (int)(img.Width * scale);
                        int h = (int)(img.Height * scale);
                        int x = bounds.X + (bounds.Width - w) / 2;
                        int y = bounds.Y + (bounds.Height - h) / 2;
                        e.Graphics!.DrawImage(img, x, y, w, h);
                        currentPage++;
                        e.HasMorePages = currentPage < pageCount;
                    };

                    // Show Windows print dialog using a TopMost owner form
                    using var ownerForm = new Form
                    {
                        Width = 1,
                        Height = 1,
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
                        printDoc.Print();
                        actionResult = "printing";
                        Console.WriteLine("✅ PDF sent to printer");
                    }
                    else
                    {
                        actionResult = "cancelled";
                        Console.WriteLine("❌ Print cancelled by user");
                    }
                    ownerForm.Close();
                  }
                  catch (Exception dialogEx)
                  {
                    Console.WriteLine($"❌ Print error: {dialogEx.Message}");
                    LogError("PDF print error", dialogEx);
                    actionResult = "error";
                  }
                });

                dialogThread.SetApartmentState(ApartmentState.STA);
                dialogThread.Start();
                dialogThread.Join();
            }
            else
            {
                // For non-PDF files: open directly with default application
                Console.WriteLine($"📂 Opening {fileName} with default application...");
                try
                {
                    ProcessStartInfo openInfo = new()
                    {
                        FileName = tempFilePath,
                        UseShellExecute = true
                    };
                    Process.Start(openInfo);
                    actionResult = "opened";
                    Console.WriteLine($"✅ Opened {fileName} with default application");
                }
                catch (Exception openEx)
                {
                    Console.WriteLine($"⚠️ Default app open failed: {openEx.Message}, opening folder...");
                    Process.Start("explorer.exe", $"/select,\"{tempFilePath}\"");
                    actionResult = "opened_folder";
                }
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
                    version = "1.0.0-simple",
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