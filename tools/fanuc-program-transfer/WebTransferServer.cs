using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Collections.Generic;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using System.Security.Cryptography;

// Loopback companion for the company's website. No Firebase queue or internet listener.
public sealed class LtdWebTransferServer : IDisposable {
 [DataContract] public sealed class Request {
  [DataMember] public string action,ip,content,hash,confirmation,ticket,password;
  [DataMember] public int port,number;
 }
 [DataContract] public sealed class Entry {
  [DataMember] public int number;
  [DataMember] public int? length;
  [DataMember] public string program,comment,modified;
 }
 [DataContract] public sealed class Response {
  [DataMember] public bool ok;
  [DataMember] public string message,ip,program,hash,ticket,text,token;
  [DataMember] public int port;
  [DataMember] public Entry[] programs;
 }
 private readonly TcpListener listener;private readonly string library,origin;private readonly int webPort;
 private volatile bool running,busy;private Thread worker;private readonly object gate=new object();private string log="Sẵn sàng.";
 private string ticket,ticketHash,ticketSession;private DateTime ticketExpiry;
 private readonly TransferPasswordStore passwords;
 [DataContract] public sealed class RegisteredMachine {
  [DataMember] public string machineId,machineName,cncIp;
  [DataMember] public int port;
 }
 private sealed class LoginSession {public DateTime expires;public string endpoint;}
 private readonly Dictionary<string,LoginSession> sessions=new Dictionary<string,LoginSession>();
 private Dictionary<string,string> machines=new Dictionary<string,string>();
 public int MachineCount {get{lock(gate){return machines.Count;}}}
 public bool TrySetMachines(string json){
  RegisteredMachine[] rows;using(MemoryStream input=new MemoryStream(Encoding.UTF8.GetBytes(json))){rows=(RegisteredMachine[])new DataContractJsonSerializer(typeof(RegisteredMachine[])).ReadObject(input);}
  if(rows==null||rows.Length>256)throw new InvalidOperationException("Danh sách máy không hợp lệ.");
  Dictionary<string,string> next=new Dictionary<string,string>();
  foreach(RegisteredMachine row in rows){if(row==null||row.port<1||row.port>65535)throw new InvalidOperationException("Cổng máy không hợp lệ.");FanucProgramTransfer.ValidateTarget(row.cncIp,(ushort)row.port);string key=Endpoint(row.cncIp,row.port);if(next.ContainsKey(key))throw new InvalidOperationException("Hai máy trùng IP/cổng.");next.Add(key,row.machineName??row.machineId??row.cncIp);}
  lock(gate){if(busy)return false;machines=next;List<string> removed=new List<string>();foreach(KeyValuePair<string,LoginSession> entry in sessions)if(!machines.ContainsKey(entry.Value.endpoint))removed.Add(entry.Key);foreach(string token in removed){sessions.Remove(token);if(ticketSession==token)ticket=null;}return true;}
 }
 private static string Endpoint(string ip,int port){return ip+":"+port.ToString(System.Globalization.CultureInfo.InvariantCulture);}
 private void RequireRegistered(Request request){if(request==null)throw new InvalidOperationException("Yêu cầu không hợp lệ.");lock(gate){if(!machines.ContainsKey(Endpoint(request.ip,request.port)))throw new InvalidOperationException("Máy này chưa có trong cấu hình Manager hoặc IP/cổng trên web khác cấu hình đã lưu. Kiểm tra khai báo máy.");}}
 private int failedLogins;private DateTime blockedUntil;
 private string currentSession,authRevision;
 public bool Busy {get{return busy;}}public string LastMessage {get{lock(gate){return log;}}}
 public LtdWebTransferServer(string ip,ushort port,string lib,int localPort):this(ip,port,lib,localPort,TransferPasswordStore.DefaultPath){}
 public LtdWebTransferServer(string ip,ushort port,string lib,int localPort,string passwordPath){
  FanucProgramTransfer.ValidateTarget(ip,port);if(localPort<1024||localPort>65535)throw new ArgumentException("Invalid local port.");
  library=lib;webPort=localPort;origin="https://storageltd.github.io";
  listener=new TcpListener(IPAddress.Loopback,localPort);listener.ExclusiveAddressUse=true;
  passwords=new TransferPasswordStore(passwordPath);authRevision=passwords.Revision;machines.Add(Endpoint(ip,port),ip);
 }
 private static string RandomCode(){byte[] bytes=new byte[32];using(RandomNumberGenerator rng=RandomNumberGenerator.Create()){rng.GetBytes(bytes);}return BitConverter.ToString(bytes).Replace("-","");}
 public void Start(){listener.Start(4);running=true;worker=new Thread(Serve);worker.IsBackground=true;worker.Start();}
 public bool TryStop(){lock(gate){if(busy)return false;running=false;ticket=null;sessions.Clear();}listener.Stop();return true;}
 public void Stop(){if(!TryStop())throw new InvalidOperationException("CNC operation is active; wait before closing.");}
 public void Dispose(){Stop();if(worker!=null)worker.Join(250);}
 private void Note(string message){lock(gate){log=DateTime.Now.ToString("HH:mm:ss")+" · "+message;}}
 private static bool SameCode(string a,string b){if(a==null||b==null||a.Length!=b.Length)return false;int diff=0;for(int i=0;i<a.Length;i++)diff|=a[i]^b[i];return diff==0;}
 private void Serve(){while(running){try{using(TcpClient client=listener.AcceptTcpClient()){Handle(client);}}catch(SocketException){if(!running)break;}catch(ObjectDisposedException){if(!running)break;}catch(Exception){Note("Yêu cầu cục bộ không hợp lệ hoặc kết nối bị đóng.");}finally{busy=false;}}}
 private void Handle(TcpClient client){
  client.ReceiveTimeout=10000;client.SendTimeout=10000;
  using(NetworkStream stream=client.GetStream()){
   StringBuilder headers=new StringBuilder();while(headers.Length<8192){int ch=stream.ReadByte();if(ch<0)return;headers.Append((char)ch);if(headers.ToString().EndsWith("\r\n\r\n",StringComparison.Ordinal))break;}
   if(!headers.ToString().EndsWith("\r\n\r\n",StringComparison.Ordinal)){Reply(stream,400,new Response{message="Headers too large."},false);return;}
   string[] lines=headers.ToString().Split(new string[]{"\r\n"},StringSplitOptions.None),first=lines[0].Split(' ');
   Dictionary<string,string> map=new Dictionary<string,string>(StringComparer.OrdinalIgnoreCase);
   for(int i=1;i<lines.Length;i++){if(lines[i].Length==0)continue;int colon=lines[i].IndexOf(':');if(colon<1){Reply(stream,400,new Response{message="Invalid headers."},false);return;}string key=lines[i].Substring(0,colon).Trim();if(map.ContainsKey(key)){Reply(stream,400,new Response{message="Duplicate headers."},false);return;}map.Add(key,lines[i].Substring(colon+1).Trim());}
   string host,requestOrigin;bool allowed=map.TryGetValue("Host",out host)&&(host=="127.0.0.1:"+webPort||host=="localhost:"+webPort)&&map.TryGetValue("Origin",out requestOrigin)&&requestOrigin==origin;
   if(!allowed){Reply(stream,403,new Response{message="Origin/host rejected."},false);return;}
   if(first.Length!=3||first[1]!="/transfer"){Reply(stream,404,new Response{message="Unknown endpoint."},true);return;}
   if(first[0]=="OPTIONS"){Reply(stream,200,new Response{ok=true},true);return;}
   string code,contentType,lengthText;int length;
   if(first[0]!="POST"||map.ContainsKey("Transfer-Encoding")){Reply(stream,403,new Response{message="POST JSON only."},true);return;}
   map.TryGetValue("X-LTD-Token",out code);
   if(!map.TryGetValue("Content-Type",out contentType)||!contentType.StartsWith("application/json",StringComparison.OrdinalIgnoreCase)||!map.TryGetValue("Content-Length",out lengthText)||!int.TryParse(lengthText,out length)||length<2||length>5*1024*1024){Reply(stream,400,new Response{message="Invalid JSON body size/type."},true);return;}
   byte[] bytes=new byte[length];int read=0;while(read<length){int count=stream.Read(bytes,read,length-read);if(count==0)return;read+=count;}
   bool accepted;lock(gate){accepted=running;if(accepted)busy=true;}
   if(!accepted){Reply(stream,400,new Response{message="Tiện ích đã dừng."},true);return;}
   try{
    Request request;using(MemoryStream data=new MemoryStream(bytes)){request=(Request)new DataContractJsonSerializer(typeof(Request)).ReadObject(data);}
    if(!running)throw new InvalidOperationException("Tiện ích đã dừng.");
    RequireRegistered(request);
    string revision=passwords.Revision;if(revision!=authRevision){sessions.Clear();ticket=null;authRevision=revision;}
    if(request.action=="login"){
     if(DateTime.UtcNow<blockedUntil){Reply(stream,429,new Response{message="Nhập sai nhiều lần. Chờ 60 giây rồi đăng nhập lại."},true);return;}
     bool valid;try{valid=passwords.Verify(request.password);}finally{request.password=null;}
     if(!valid){failedLogins++;if(failedLogins>=5){blockedUntil=DateTime.UtcNow.AddSeconds(60);failedLogins=0;}Reply(stream,401,new Response{message="Mật khẩu truyền/nhận không đúng."},true);return;}
     failedLogins=0;DateTime now=DateTime.UtcNow;List<string> expired=new List<string>();foreach(KeyValuePair<string,LoginSession> entry in sessions)if(entry.Value.expires<=now)expired.Add(entry.Key);foreach(string old in expired)sessions.Remove(old);
     if(sessions.Count>=8)sessions.Clear();string token=RandomCode();sessions[token]=new LoginSession{expires=now.AddMinutes(30),endpoint=Endpoint(request.ip,request.port)};
     Reply(stream,200,new Response{ok=true,token=token,ip=request.ip,port=request.port,message="Đăng nhập truyền/nhận thành công."},true);return;
    }
    LoginSession session;if(code==null||!sessions.TryGetValue(code,out session)||DateTime.UtcNow>=session.expires){if(code!=null)sessions.Remove(code);Reply(stream,401,new Response{message="Phiên truyền đã hết hạn. Đăng nhập bằng mật khẩu truyền/nhận."},true);return;}
    if(session.endpoint!=Endpoint(request.ip,request.port)){Reply(stream,401,new Response{message="Phiên đăng nhập thuộc máy khác. Đăng nhập mật khẩu cho máy đang mở."},true);return;}
    if(request.action=="logout"){sessions.Remove(code);if(ticketSession==code)ticket=null;Reply(stream,200,new Response{ok=true,message="Đã đăng xuất truyền/nhận."},true);return;}
    currentSession=code;Response result=Execute(request);Reply(stream,200,result,true);
   }catch(Exception e){Note("Lỗi: "+e.Message);Reply(stream,400,new Response{message=e.Message},true);}
   finally{busy=false;}
  }
 }
 private Response Execute(Request request){
  RequireRegistered(request);string target=request.ip;ushort cncPort=(ushort)request.port;
  Response result=new Response{ok=true,ip=target,port=cncPort};
  if(request.action=="connect"){result.message="Đã xác thực phiên truyền/nhận. Chưa kiểm tra kết nối CNC.";return result;}
  if(request.action=="list"){
   FanucProgramTransfer.ProgramEntry[] list=FanucProgramTransfer.ListPrograms(target,cncPort,library);List<Entry> rows=new List<Entry>();
   foreach(FanucProgramTransfer.ProgramEntry p in list)rows.Add(new Entry{number=p.Number,length=p.Length,program=p.Program,comment=p.Comment,modified=p.Modified});result.programs=rows.ToArray();result.message="Đã đọc "+rows.Count+" chương trình trong bộ nhớ CNC.";
  }else if(request.action=="receive"){
   byte[] data=FanucProgramTransfer.Receive(target,cncPort,library,request.number);result.text=Encoding.ASCII.GetString(data);result.program="O"+request.number.ToString("D4");result.message="Đã đọc đủ chương trình từ CNC về laptop.";
  }else if(request.action=="inspect"||request.action=="send"){
   if(request.content==null||request.content.Length>2*1024*1024)throw new InvalidOperationException("NC file vượt 2 MiB.");
   foreach(char ch in request.content)if(ch>127)throw new InvalidOperationException("Chỉ hỗ trợ file NC ASCII.");
   string path=Path.Combine(Path.GetTempPath(),"ltd-transfer-"+Guid.NewGuid().ToString("N")+".nc");
   try{
    using(FileStream file=new FileStream(path,FileMode.CreateNew,FileAccess.Write,FileShare.None)){byte[] data=Encoding.ASCII.GetBytes(request.content);file.Write(data,0,data.Length);}
    FanucProgramTransfer.SelectedProgram selected=FanucProgramTransfer.ValidateFile(path);
    result.hash=selected.Hash;result.program=selected.Program;
    if(request.action=="inspect"){
     ticket=null;result.message=FanucProgramTransfer.Inspect(target,cncPort,library,path);ticket=RandomCode();ticketHash=selected.Hash;ticketSession=currentSession;ticketExpiry=DateTime.UtcNow.AddMinutes(2);result.ticket=ticket;
    }else{
     bool valid=ticketSession==currentSession&&SameCode(request.ticket,ticket)&&request.hash==ticketHash&&selected.Hash==ticketHash&&DateTime.UtcNow<ticketExpiry;
     ticket=null;
     if(!valid)throw new InvalidOperationException("Kiểm tra trước truyền đã hết hạn hoặc file thay đổi. Kiểm tra lại.");
     result.message=FanucProgramTransfer.Send(target,cncPort,library,path,request.hash,request.confirmation);
    }
   }finally{try{if(File.Exists(path))File.Delete(path);}catch(IOException){Note("Không xóa được file tạm trên laptop.");}catch(UnauthorizedAccessException){Note("Không xóa được file tạm trên laptop.");}}
  }else throw new InvalidOperationException("Thao tác không được hỗ trợ.");
  Note(result.message);return result;
 }
 private void Reply(NetworkStream stream,int code,Response result,bool cors){
  byte[] body;using(MemoryStream output=new MemoryStream()){new DataContractJsonSerializer(typeof(Response)).WriteObject(output,result);body=output.ToArray();}
  string header="HTTP/1.1 "+code+" "+(code==200?"OK":"Rejected")+"\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: "+body.Length+"\r\nConnection: close\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\n";
  if(cors)header+="Access-Control-Allow-Origin: "+origin+"\r\nVary: Origin\r\nAccess-Control-Allow-Methods: POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type, X-LTD-Token\r\nAccess-Control-Allow-Private-Network: true\r\n";
  byte[] head=Encoding.ASCII.GetBytes(header+"\r\n");stream.Write(head,0,head.Length);stream.Write(body,0,body.Length);
 }
}
