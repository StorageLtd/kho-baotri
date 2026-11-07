using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;

// Loopback-only viewer. Fixed read-only routes; no cloud calls, file browsing or CNC commands.
public sealed class FanucLocalServer : IDisposable
{
    private readonly TcpListener listener;
    private readonly byte[] page;
    private readonly int port;
    private readonly object gate = new object();
    private string status = "{\"connected\":false,\"error\":\"Waiting for CNC\"}";
    private volatile bool running;
    private Thread worker;
    public FanucLocalServer(int port, string htmlPath)
    {
        this.port = port;
        page = File.ReadAllBytes(htmlPath);
        listener = new TcpListener(IPAddress.Loopback, port);
        listener.ExclusiveAddressUse = true;
    }
    public void Update(string json) { lock (gate) { status = json; } }
    public void Start()
    {
        listener.Start(8);
        running = true;
        worker = new Thread(Serve); worker.IsBackground = true; worker.Start();
    }
    private void Serve()
    {
        while (running)
        {
            try { using (TcpClient client = listener.AcceptTcpClient()) { Handle(client); } }
            catch (SocketException) { if (!running) break; }
            catch (ObjectDisposedException) { if (!running) break; }
            catch (IOException) { }
            catch (Exception) { /* A bad local request must not terminate the viewer. */ }
        }
    }
    private void Handle(TcpClient client)
    {
        client.ReceiveTimeout = 1500; client.SendTimeout = 1500;
        using (NetworkStream stream = client.GetStream())
        {
            StringBuilder request = new StringBuilder();
            while (request.Length < 8192)
            {
                int ch = stream.ReadByte(); if (ch < 0) return;
                request.Append((char)ch);
                int n = request.Length;
                if (n >= 4 && request[n-4]=='\r' && request[n-3]=='\n' && request[n-2]=='\r' && request[n-1]=='\n') break;
            }
            if (!request.ToString().EndsWith("\r\n\r\n", StringComparison.Ordinal)) { Reply(stream, 431, "text/plain", Encoding.UTF8.GetBytes("Headers too large")); return; }
            string[] lines = request.ToString().Split(new string[] { "\r\n" }, StringSplitOptions.None);
            string[] first = lines[0].Split(' ');
            if (first.Length != 3 || first[0] != "GET") { Reply(stream, 405, "text/plain", Encoding.UTF8.GetBytes("GET only")); return; }
            string host = null, origin = null, site = null;
            for (int i=1; i<lines.Length; i++)
            {
                int colon = lines[i].IndexOf(':'); if (colon < 1) continue;
                string key=lines[i].Substring(0,colon).Trim(), value=lines[i].Substring(colon+1).Trim();
                if (key.Equals("Host",StringComparison.OrdinalIgnoreCase)) { if (host!=null) { Reply(stream,400,"text/plain",new byte[0]);return; } host=value; }
                if (key.Equals("Origin",StringComparison.OrdinalIgnoreCase)) origin=value;
                if (key.Equals("Sec-Fetch-Site",StringComparison.OrdinalIgnoreCase)) site=value;
            }
            bool allowedHost = host == "localhost:"+port || host == "127.0.0.1:"+port;
            bool allowedOrigin = origin == null || origin == "http://localhost:"+port || origin == "http://127.0.0.1:"+port;
            if (!allowedHost || !allowedOrigin || site == "cross-site") { Reply(stream,403,"text/plain",Encoding.UTF8.GetBytes("Local access only")); return; }
            string path=first[1].Split('?')[0];
            if (path == "/") Reply(stream,200,"text/html; charset=utf-8",page);
            else if (path == "/api/status") { string json; lock(gate) { json=status; } Reply(stream,200,"application/json; charset=utf-8",Encoding.UTF8.GetBytes(json)); }
            else Reply(stream,404,"text/plain",Encoding.UTF8.GetBytes("Not found"));
        }
    }
    private static void Reply(NetworkStream stream,int code,string type,byte[] body)
    {
        string reason=code==200?"OK":code==403?"Forbidden":code==404?"Not Found":code==405?"Method Not Allowed":code==431?"Request Header Fields Too Large":"Bad Request";
        string headers="HTTP/1.1 "+code+" "+reason+"\r\nContent-Type: "+type+"\r\nContent-Length: "+body.Length+"\r\nConnection: close\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nReferrer-Policy: no-referrer\r\nContent-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'\r\n\r\n";
        byte[] bytes=Encoding.ASCII.GetBytes(headers);stream.Write(bytes,0,bytes.Length);stream.Write(body,0,body.Length);
    }
    public void Dispose() { running=false;listener.Stop();if(worker!=null)worker.Join(2000); }
}
