using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Collections.Generic;
using System.Collections.Concurrent;
using System.Security.Cryptography;

public sealed class OfflineRequest {
 public string Method,Target,Body,Cookie,Csrf;
 public int Status=500;public string Type="application/json; charset=utf-8",SetCookie;
 public byte[] Result=Encoding.UTF8.GetBytes("{\"error\":\"Request not processed\"}");
 public readonly ManualResetEventSlim Done=new ManualResetEventSlim(false);
 public void Respond(int status,string json,string cookie){Status=status;Result=Encoding.UTF8.GetBytes(json);SetCookie=cookie;Done.Set();}
}
public sealed class OfflineHost:IDisposable {
 private TcpListener listener;private Thread worker;private volatile bool running;private int port;
 private readonly ConcurrentQueue<OfflineRequest> queue=new ConcurrentQueue<OfflineRequest>();
 private readonly Dictionary<string,byte[]> files=new Dictionary<string,byte[]>(StringComparer.Ordinal);
 private readonly Semaphore slots=new Semaphore(12,12);
 public OfflineHost(int port,string root){
  this.port=port;listener=new TcpListener(IPAddress.Loopback,port);listener.ExclusiveAddressUse=true;
  root=Path.GetFullPath(root);
  foreach(string file in Directory.GetFiles(root,"*",SearchOption.AllDirectories)){
   string path="/"+file.Substring(root.Length).TrimStart(Path.DirectorySeparatorChar).Replace('\\','/');
   if(path=="/index.html"||path=="/logo.jpg"||path.StartsWith("/assets/",StringComparison.Ordinal))files[path]=File.ReadAllBytes(file);
  }
 }
 public bool TryTake(out OfflineRequest request){return queue.TryDequeue(out request);}
 public void Start(){listener.Start(16);running=true;worker=new Thread(Serve);worker.IsBackground=true;worker.Start();}
 private void Serve(){while(running){try{TcpClient client=listener.AcceptTcpClient();if(!slots.WaitOne(0)){client.Close();continue;}ThreadPool.QueueUserWorkItem(delegate{try{using(client){Handle(client);}}catch{}finally{slots.Release();}});}catch{if(!running)break;}}}
 private void Handle(TcpClient client){
  client.ReceiveTimeout=5000;client.SendTimeout=10000;
  using(NetworkStream stream=client.GetStream()){
   StringBuilder input=new StringBuilder();while(input.Length<8192){int c=stream.ReadByte();if(c<0)return;input.Append((char)c);if(input.ToString().EndsWith("\r\n\r\n",StringComparison.Ordinal))break;}
   if(!input.ToString().EndsWith("\r\n\r\n",StringComparison.Ordinal)){Reply(stream,431,"text/plain",new byte[0],null);return;}
   string[] lines=input.ToString().Split(new string[]{"\r\n"},StringSplitOptions.None),first=lines[0].Split(' ');
   if(first.Length!=3||!first[1].StartsWith("/",StringComparison.Ordinal)||first[1].StartsWith("//",StringComparison.Ordinal)){Reply(stream,400,"text/plain",new byte[0],null);return;}
   Dictionary<string,string> headers=new Dictionary<string,string>(StringComparer.OrdinalIgnoreCase);
   for(int i=1;i<lines.Length;i++){if(lines[i].Length==0)continue;int colon=lines[i].IndexOf(':');if(colon<1){Reply(stream,400,"text/plain",new byte[0],null);return;}string key=lines[i].Substring(0,colon).Trim();if(headers.ContainsKey(key)){Reply(stream,400,"text/plain",new byte[0],null);return;}headers[key]=lines[i].Substring(colon+1).Trim();}
   string host;headers.TryGetValue("Host",out host);string origin,site;headers.TryGetValue("Origin",out origin);headers.TryGetValue("Sec-Fetch-Site",out site);
   if((host!="localhost:"+port&&host!="127.0.0.1:"+port)||(origin!=null&&origin!="http://"+host)||site=="cross-site"||headers.ContainsKey("Transfer-Encoding")){Reply(stream,403,"text/plain",new byte[0],null);return;}
   string path=first[1].Split('?')[0];
   if(!path.StartsWith("/api/",StringComparison.Ordinal)){
    if(first[0]!="GET"){Reply(stream,405,"text/plain",new byte[0],null);return;}
    byte[] file;if(path=="/")path="/index.html";
    if(!files.TryGetValue(path,out file)){Reply(stream,404,"text/plain",new byte[0],null);return;}
    string ext=Path.GetExtension(path),type=ext==".html"?"text/html; charset=utf-8":ext==".js"?"text/javascript; charset=utf-8":ext==".css"?"text/css; charset=utf-8":ext==".jpg"?"image/jpeg":"application/octet-stream";
    Reply(stream,200,type,file,null);return;
   }
   int length=0;string contentLength;if(headers.TryGetValue("Content-Length",out contentLength)&&(!int.TryParse(contentLength,out length)||length<0||length>33554432)){Reply(stream,413,"text/plain",new byte[0],null);return;}
   if(first[0]!="GET"&&first[0]!="HEAD"){
    string contentType;if(origin!="http://"+host||!headers.TryGetValue("Content-Type",out contentType)||!contentType.StartsWith("application/json",StringComparison.OrdinalIgnoreCase)){Reply(stream,403,"text/plain",new byte[0],null);return;}
   }
   byte[] body=new byte[length];int offset=0;while(offset<length){int got=stream.Read(body,offset,length-offset);if(got<=0)return;offset+=got;}
   OfflineRequest request=new OfflineRequest{Method=first[0],Target=first[1],Body=new UTF8Encoding(false,true).GetString(body)};
   headers.TryGetValue("Cookie",out request.Cookie);headers.TryGetValue("X-LTD-CSRF",out request.Csrf);queue.Enqueue(request);
   if(!request.Done.Wait(20000)){Reply(stream,503,"application/json",Encoding.UTF8.GetBytes("{\"error\":\"Local server busy\"}"),null);return;}
   Reply(stream,request.Status,request.Type,request.Result,request.SetCookie);
  }
 }
 private void Reply(NetworkStream stream,int code,string type,byte[] body,string cookie){
  string headers="HTTP/1.1 "+code+" Response\r\nContent-Type: "+type+"\r\nContent-Length: "+body.Length+"\r\nConnection: close\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nReferrer-Policy: no-referrer\r\nContent-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' data:; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'none'\r\n";
  if(cookie!=null)headers+="Set-Cookie: "+cookie+"\r\n";
  byte[] bytes=Encoding.ASCII.GetBytes(headers+"\r\n");stream.Write(bytes,0,bytes.Length);stream.Write(body,0,body.Length);
 }
 public void Dispose(){running=false;listener.Stop();if(worker!=null)worker.Join(2000);OfflineRequest request;while(queue.TryDequeue(out request))request.Respond(503,"{\"error\":\"Server stopped\"}",null);}
}
public static class OfflineCrypto {
 public static string Token(){byte[] value=new byte[32];using(RandomNumberGenerator rng=RandomNumberGenerator.Create())rng.GetBytes(value);return Convert.ToBase64String(value).TrimEnd('=').Replace('+','-').Replace('/','_');}
 public static string Hash(string password){byte[] salt=new byte[16];using(RandomNumberGenerator rng=RandomNumberGenerator.Create())rng.GetBytes(salt);using(Rfc2898DeriveBytes k=new Rfc2898DeriveBytes(password,salt,150000,HashAlgorithmName.SHA256))return Convert.ToBase64String(salt)+":"+Convert.ToBase64String(k.GetBytes(32));}
 public static bool Equal(string a,string b){if(a==null||b==null||a.Length!=b.Length)return false;int diff=0;for(int i=0;i<a.Length;i++)diff|=a[i]^b[i];return diff==0;}
 public static bool Verify(string password,string stored){try{string[] parts=stored.Split(':');using(Rfc2898DeriveBytes k=new Rfc2898DeriveBytes(password,Convert.FromBase64String(parts[0]),150000,HashAlgorithmName.SHA256))return Equal(Convert.ToBase64String(k.GetBytes(32)),parts[1]);}catch{return false;}}
}
