using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Printing;
using System.IO;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
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

            // Show dialog on UI thread
            string? selectedAction = null;
            string? savedPath = null;

            var dialogThread = new Thread(() =>
            {
                var result = ShowFileDialog(fileName, tempFilePath, fileBytes.Length, isPDF, defaultSavePath);
                selectedAction = result.action;
                savedPath = result.path;
            });
            dialogThread.SetApartmentState(ApartmentState.STA);
            dialogThread.Start();
            dialogThread.Join();

            // Execute action based on dialog result
            string actionResult = "cancelled";
            string resultPath = tempFilePath;

            switch (selectedAction)
            {
                case "print":
                    Console.WriteLine("🖨️ Opening print dialog...");
                    string? selectedPrinter = null;

                    // Show native Windows print dialog on STA thread
                    var printDialogThread = new Thread(() =>
                    {
                        using var printDialog = new PrintDialog();
                        printDialog.AllowSomePages = false;
                        printDialog.AllowCurrentPage = false;
                        printDialog.AllowSelection = false;
                        printDialog.UseEXDialog = true;

                        if (printDialog.ShowDialog() == DialogResult.OK)
                        {
                            selectedPrinter = printDialog.PrinterSettings.PrinterName;
                        }
                    });
                    printDialogThread.SetApartmentState(ApartmentState.STA);
                    printDialogThread.Start();
                    printDialogThread.Join();

                    if (!string.IsNullOrEmpty(selectedPrinter))
                    {
                        Console.WriteLine($"🖨️ Printing to: {selectedPrinter}");
                        try
                        {
                            // Use PowerShell to print PDF to selected printer
                            var psi = new ProcessStartInfo
                            {
                                FileName = "powershell.exe",
                                Arguments = $"-Command \"Start-Process -FilePath '{tempFilePath}' -Verb Print -PassThru | ForEach-Object {{ Start-Sleep -Seconds 3; $_ | Stop-Process -Force }}\"",
                                UseShellExecute = false,
                                CreateNoWindow = true
                            };
                            Process.Start(psi);
                            actionResult = "printed";
                            Console.WriteLine("✅ Print job sent");
                        }
                        catch (Exception printEx)
                        {
                            Console.WriteLine($"⚠️ Print error: {printEx.Message}");
                            // Fallback: copy to printer spool
                            try
                            {
                                var copyPsi = new ProcessStartInfo
                                {
                                    FileName = "cmd.exe",
                                    Arguments = $"/c copy /b \"{tempFilePath}\" \"\\\\localhost\\{selectedPrinter}\"",
                                    UseShellExecute = false,
                                    CreateNoWindow = true
                                };
                                Process.Start(copyPsi);
                                actionResult = "printed";
                            }
                            catch
                            {
                                Process.Start("explorer.exe", $"/select,\"{tempFilePath}\"");
                                actionResult = "opened_folder";
                            }
                        }
                    }
                    else
                    {
                        Console.WriteLine("❌ Print cancelled by user");
                        actionResult = "cancelled";
                    }
                    break;

                case "save":
                    if (!string.IsNullOrEmpty(savedPath))
                    {
                        File.Copy(tempFilePath, savedPath, true);
                        resultPath = savedPath;
                        Console.WriteLine($"💾 Saved to: {savedPath}");
                        actionResult = "saved";
                    }
                    break;

                case "open":
                    Console.WriteLine("📂 Opening file...");
                    try
                    {
                        // Try to open with default app
                        ProcessStartInfo openInfo = new()
                        {
                            FileName = tempFilePath,
                            UseShellExecute = true
                        };
                        Process.Start(openInfo);
                        actionResult = "opened";
                    }
                    catch
                    {
                        // Fallback: open file location in explorer
                        Process.Start("explorer.exe", $"/select,\"{tempFilePath}\"");
                        actionResult = "opened_folder";
                        Console.WriteLine("⚠️ Open failed, opened folder instead");
                    }
                    break;

                default:
                    Console.WriteLine("❌ User cancelled");
                    actionResult = "cancelled";
                    break;
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
        using var form = new Form
        {
            Text = "Guacamole File Transfer",
            Size = new Size(420, 200),
            StartPosition = FormStartPosition.CenterScreen,
            FormBorderStyle = FormBorderStyle.FixedDialog,
            MaximizeBox = false,
            MinimizeBox = false,
            TopMost = true
        };

        var label = new Label
        {
            Text = $"📁 Received: {fileName}\n📊 Size: {fileSize:N0} bytes\n\nWhat would you like to do?",
            Location = new Point(20, 15),
            Size = new Size(370, 55),
            Font = new Font("Segoe UI", 10)
        };

        int btnX = 20;
        var btnPrint = new Button
        {
            Text = "🖨️ Print",
            Location = new Point(btnX, 85),
            Size = new Size(85, 35),
            Font = new Font("Segoe UI", 9)
        };

        btnX = isPDF ? 115 : 20; // Shift buttons if no Print button

        var btnSave = new Button
        {
            Text = "💾 Save",
            Location = new Point(btnX, 85),
            Size = new Size(85, 35),
            Font = new Font("Segoe UI", 9)
        };

        var btnOpen = new Button
        {
            Text = "📂 Open",
            Location = new Point(btnX + 95, 85),
            Size = new Size(85, 35),
            Font = new Font("Segoe UI", 9)
        };

        var btnCancel = new Button
        {
            Text = "❌ Cancel",
            Location = new Point(btnX + 190, 85),
            Size = new Size(85, 35),
            Font = new Font("Segoe UI", 9)
        };

        string? action = null;
        string? savedPath = defaultSavePath; // Default to user folder

        btnPrint.Click += (s, e) => { action = "print"; form.Close(); };
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
                Title = "Save File"
            };

            if (saveDialog.ShowDialog() == DialogResult.OK)
            {
                savedPath = saveDialog.FileName;
                action = "save";
                form.Close();
            }
        };

        // Add controls - Print button only for PDFs
        if (isPDF)
        {
            form.Controls.AddRange(new Control[] { label, btnPrint, btnSave, btnOpen, btnCancel });
            form.AcceptButton = btnPrint;
        }
        else
        {
            form.Controls.AddRange(new Control[] { label, btnSave, btnOpen, btnCancel });
            form.AcceptButton = btnSave;
        }
        form.CancelButton = btnCancel;

        // Bring to front
        form.Shown += (s, e) =>
        {
            form.BringToFront();
            form.Activate();
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