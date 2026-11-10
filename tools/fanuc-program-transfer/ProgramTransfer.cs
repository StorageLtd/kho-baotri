using System;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.ComponentModel;
using System.Globalization;

// Separate, explicitly confirmed program download trial. Not used by monitoring bridges.
public static class FanucProgramTransfer
{
    public static string Build { get { return "20261110-transfer-tool"; } }
    public sealed class ProgramEntry { public int Number,Length;public string Program,Comment,Modified; }
    public sealed class Operation { public string Kind,Message,Text,Destination;public ProgramEntry[] Programs; }
    private static int progress;
    public static int Progress { get { return Interlocked.CompareExchange(ref progress,0,0); } }
    [DllImport("kernel32.dll",EntryPoint="LoadLibraryExW",CharSet=CharSet.Unicode,SetLastError=true)] private static extern IntPtr LoadLibraryEx(string path,IntPtr reserved,uint flags);
    [DllImport("Fwlib64.dll",ExactSpelling=true)] private static extern short cnc_upstart3(ushort handle,short type,int start,int end);
    [DllImport("Fwlib64.dll",ExactSpelling=true)] private static extern short cnc_upload3(ushort handle,ref int length,[Out] byte[] data);
    [DllImport("Fwlib64.dll",ExactSpelling=true)] private static extern short cnc_upend3(ushort handle);
    private static readonly object LibraryGate=new object();private static string loadedDirectory;
    public static void LoadLibrary(string library){
        if(IntPtr.Size!=8||Environment.OSVersion.Platform!=PlatformID.Win32NT)throw new InvalidOperationException("Use 64-bit Windows PowerShell.");
        string directory=Path.GetFullPath(library);
        lock(LibraryGate){
            if(loadedDirectory!=null){if(!String.Equals(directory,loadedDirectory,StringComparison.OrdinalIgnoreCase))throw new InvalidOperationException("Restart to change DLL folder.");return;}
            foreach(string name in new string[]{"fwlibe64.dll","fwlib30i64.dll","Fwlib64.dll"}){
                string path=Path.Combine(directory,name);if(!File.Exists(path))throw new FileNotFoundException("Missing "+name);
                if(LoadLibraryEx(path,IntPtr.Zero,0x100|0x1000)==IntPtr.Zero)throw new Win32Exception(Marshal.GetLastWin32Error(),"Cannot load "+name);
            }loadedDirectory=directory;
        }
    }

    [StructLayout(LayoutKind.Sequential,Pack=4)]
    private struct Status {public short hdck,tmmode,aut,run,motion,mstb,emergency,alarm,edit;}
    [DllImport("Fwlib64.dll",ExactSpelling=true,CharSet=CharSet.Ansi)] private static extern short cnc_allclibhndl3(string ip,ushort port,int timeout,out ushort handle);
    [DllImport("Fwlib64.dll",ExactSpelling=true)] private static extern short cnc_freelibhndl(ushort handle);
    [DllImport("Fwlib64.dll",ExactSpelling=true)] private static extern short cnc_statinfo(ushort handle,out Status status);
    [DllImport("Fwlib64.dll",ExactSpelling=true)] private static extern short cnc_rdprogdir3(ushort handle,short type,ref int number,ref short count,IntPtr data);
    [DllImport("Fwlib64.dll",ExactSpelling=true)] private static extern short cnc_dwnstart3(ushort handle,short type);
    [DllImport("Fwlib64.dll",ExactSpelling=true)] private static extern short cnc_download3(ushort handle,ref int length,[In] byte[] data);
    [DllImport("Fwlib64.dll",ExactSpelling=true)] private static extern short cnc_dwnend3(ushort handle);
    [DllImport("Fwlib64.dll",ExactSpelling=true)] private static extern short cnc_getpath(ushort handle,out short path,out short paths);
    public sealed class SelectedProgram
    {
        public string FilePath,Program,Hash,Preview;public int Number;public byte[] Bytes;
    }
    public static SelectedProgram ValidateFile(string path)
    {
        if(!File.Exists(path))throw new InvalidOperationException("Choose an NC file first.");
        FileInfo info=new FileInfo(path);
        if(info.Length<8 || info.Length>2*1024*1024)throw new InvalidOperationException("Trial supports files from 8 bytes to 2 MB.");
        byte[] bytes=File.ReadAllBytes(path);
        foreach(byte b in bytes)if(b!=9 && b!=10 && b!=13 && (b<32 || b>126))throw new InvalidOperationException("Use a plain ASCII NC file; no binary, BOM or Unicode.");
        string text=Encoding.ASCII.GetString(bytes).Replace("\r\n","\n").Replace("\r","\n").Trim();
        if(!text.StartsWith("%") || !text.EndsWith("%") || text.Split('%').Length!=3)throw new InvalidOperationException("File must contain exactly one program between two % markers.");
        int depth=0;foreach(char ch in text){if(ch=='('){if(++depth>1)throw new InvalidOperationException("Nested comments are not supported.");}if(ch==')' && --depth<0)throw new InvalidOperationException("Unbalanced comments.");}if(depth!=0)throw new InvalidOperationException("Unbalanced comments.");
        string code=Regex.Replace(text,@"\([^)]*\)","",RegexOptions.Singleline);
        MatchCollection programs=Regex.Matches(code,@"(?m)^\s*O([0-9]{1,8})(?=[^0-9]|$)");
        if(programs.Count!=1 || Regex.Matches(code,@"(?<![A-Z])O\s*[0-9]+",RegexOptions.IgnoreCase).Count!=1)throw new InvalidOperationException("Trial accepts exactly one O-number program, no bundled subprograms.");
        string body=code.Trim().Trim('%').Trim();
        if(!Regex.IsMatch(body,@"^O[0-9]{1,8}(?=[^0-9]|$)"))throw new InvalidOperationException("The first NC block must declare the O-number.");
        int number=int.Parse(programs[0].Groups[1].Value);
        if(number<1 || number>7999)throw new InvalidOperationException("Trial allows O0001-O7999 only; reserved programs are blocked.");
        if(!Regex.IsMatch(code,@"M\s*(?:0?2|30)(?![0-9])",RegexOptions.IgnoreCase))throw new InvalidOperationException("File must contain M02 or M30. This is a format check, not machining validation.");
        byte[] normalized=Encoding.ASCII.GetBytes(text+"\n");string hash;
        using(SHA256 sha=SHA256.Create()){hash=BitConverter.ToString(sha.ComputeHash(normalized)).Replace("-","");}
        return new SelectedProgram{FilePath=Path.GetFullPath(path),Number=number,Program="O"+number.ToString("D4"),Bytes=normalized,Hash=hash,Preview=text.Substring(0,Math.Min(text.Length,12000))};
    }
    public static void ValidateTarget(string ip,ushort port)
    {
        IPAddress address;
        if(!IPAddress.TryParse(ip,out address) || address.AddressFamily!=System.Net.Sockets.AddressFamily.InterNetwork)throw new InvalidOperationException("Enter the CNC IPv4 address.");
        byte[] a=address.GetAddressBytes();bool local=a[0]==10 || (a[0]==172 && a[1]>=16 && a[1]<=31) || (a[0]==192 && a[1]==168) || (a[0]==169 && a[1]==254);
        if(!local || port==0)throw new InvalidOperationException("Trial supports private LAN / link-local CNC addresses only.");
    }
    private static void Check(string operation,short code){if(code!=0)throw new InvalidOperationException(operation+": FOCAS "+code);}
    private static void CheckStoppedEdit(ushort handle)
    {
        Status state;Check("Read machine state",cnc_statinfo(handle,out state));
        ValidateMachineState(state.aut,state.run,state.alarm,state.emergency);
    }
    public static void ValidateMachineState(short mode,short run,short alarm,short emergency)
    {
        if(mode!=3 || (run!=0 && run!=1) || alarm!=0 || emergency!=0)throw new InvalidOperationException("CNC must be stopped, in EDIT mode, with no alarm/emergency. Change mode at the machine; this tool does not change it.");
    }
    public static void ValidateDirectory(short count,int found,int target)
    {
        if(count<0 || count>1)throw new InvalidOperationException("Invalid program directory response; transmission blocked.");
        if(count==1){if(found==target)throw new InvalidOperationException("Program already exists. Overwriting is blocked; choose an unused O-number in your file.");if(found<target)throw new InvalidOperationException("Cannot prove O-number is unused; transmission blocked.");}
    }
    private static void RequireUnused(ushort handle,int target)
    {
        int cursor=target;short count=1;IntPtr buffer=Marshal.AllocHGlobal(88);
        try {
            Marshal.Copy(new byte[88],0,buffer,88);
            Check("Check existing O-number",cnc_rdprogdir3(handle,2,ref cursor,ref count,buffer));
            ValidateDirectory(count,Marshal.ReadInt32(buffer),target);
        } finally {Marshal.FreeHGlobal(buffer);}
    }
    private static ushort Open(string ip,ushort port,string library)
    {
        ValidateTarget(ip,port);
        if(loadedDirectory==null)LoadLibrary(library);
        // DLL loading is performed once by the GUI before its background worker.
        // No telemetry polling or unrelated parameter/alarm reads are needed here.
        ushort handle;Check("Connect",cnc_allclibhndl3(ip,port,10,out handle));
        try {short path,paths;Check("Read CNC path",cnc_getpath(handle,out path,out paths));ValidatePath(path,paths);return handle;}
        catch {cnc_freelibhndl(handle);throw;}
    }
    public static void ValidatePath(short path,short paths)
    {
        if(path!=1 || paths!=1)throw new InvalidOperationException("Trial supports a single CNC path only. Multi-path machines require a verified channel configuration.");
    }
    public static string Inspect(string ip,ushort port,string library,string file)
    {
        SelectedProgram selected=ValidateFile(file);ushort handle=Open(ip,port,library);
        try {CheckStoppedEdit(handle);RequireUnused(handle,selected.Number);return selected.Program+" is unused; CNC is stopped in EDIT. Confirm IP and file at the machine before sending.";}finally{cnc_freelibhndl(handle);}
    }
    public static string Send(string ip,ushort port,string library,string file,string expectedHash,string confirmation)
    {
        SelectedProgram selected=ValidateFile(file);
        if(expectedHash!=selected.Hash)throw new InvalidOperationException("File changed after selection. Select and inspect it again.");
        if(confirmation!="TRUYEN "+selected.Program)throw new InvalidOperationException("Type exactly: TRUYEN "+selected.Program);
        ushort handle=Open(ip,port,library);bool started=false,finished=false;
        try {
            CheckStoppedEdit(handle);RequireUnused(handle,selected.Number);CheckStoppedEdit(handle);
            Check("Start transfer",cnc_dwnstart3(handle,0));started=true;
            Interlocked.Exchange(ref progress,0);int position=0;DateTime deadline=DateTime.UtcNow.AddSeconds(90);
            while(position<selected.Bytes.Length){
                if(DateTime.UtcNow>deadline)throw new TimeoutException("Transfer timeout. Do not retry automatically; inspect CNC program memory first.");
                int length=Math.Min(1280,selected.Bytes.Length-position);byte[] part=new byte[length];Buffer.BlockCopy(selected.Bytes,position,part,0,length);
                short code=cnc_download3(handle,ref length,part);
                if(code==10){Thread.Sleep(50);continue;}
                Check("Transfer data",code);
                if(length<=0 || length>part.Length)throw new InvalidOperationException("Invalid accepted byte count; transfer stopped.");
                position+=length;Interlocked.Exchange(ref progress,(int)((long)position*99/selected.Bytes.Length));
            }
            short endCode=cnc_dwnend3(handle);finished=true;Check("Finish transfer",endCode);
            Interlocked.Exchange(ref progress,100);return "CNC accepted "+selected.Program+". Verify its full contents and offsets on the machine before running. This tool has not selected or started the program.";
        }
        catch(Exception e){throw new InvalidOperationException(e.Message+(started?" A partial program may remain on the CNC. Inspect it at the machine; this tool does not delete or retry it.":" No program transfer was started."),e);}
        finally {try{if(started&&!finished)cnc_dwnend3(handle);}finally{cnc_freelibhndl(handle);}}
    }
    public static ProgramEntry DecodeEntry(byte[] data,int offset){
        if(data==null||offset<0||offset>data.Length-88)throw new InvalidOperationException("Short CNC directory record.");
        int number=BitConverter.ToInt32(data,offset),length=BitConverter.ToInt32(data,offset+4);
        if(number<1||number>99999999||length<0)throw new InvalidOperationException("Invalid CNC program record.");
        string modified="—";
        try{modified=new DateTime(BitConverter.ToInt16(data,offset+64),BitConverter.ToInt16(data,offset+66),BitConverter.ToInt16(data,offset+68),BitConverter.ToInt16(data,offset+70),BitConverter.ToInt16(data,offset+72),0).ToString("dd/MM/yyyy HH:mm",CultureInfo.InvariantCulture);}catch(ArgumentOutOfRangeException){}
        return new ProgramEntry{Number=number,Length=length,Program="O"+number.ToString("D4"),Comment=Encoding.Default.GetString(data,offset+12,52).Split('\0')[0].Trim(),Modified=modified};
    }
    public static ProgramEntry[] ListPrograms(string ip,ushort port,string library){
        ushort handle=Open(ip,port,library);const int batch=32;List<ProgramEntry> rows=new List<ProgramEntry>();
        IntPtr buffer=Marshal.AllocHGlobal(batch*88);
        try{
            int next=1;DateTime deadline=DateTime.UtcNow.AddSeconds(60);
            while(true){
                if(DateTime.UtcNow>deadline||rows.Count>=10000)throw new InvalidOperationException("Program directory exceeds trial limit; incomplete list not presented as complete.");
                int cursor=next;short count=batch;Marshal.Copy(new byte[batch*88],0,buffer,batch*88);
                Check("Read program directory",cnc_rdprogdir3(handle,2,ref cursor,ref count,buffer));
                if(count<0||count>batch)throw new InvalidOperationException("Invalid CNC directory count.");
                if(count==0)break;byte[] bytes=new byte[count*88];Marshal.Copy(buffer,bytes,0,bytes.Length);
                for(int i=0;i<count;i++){ProgramEntry row=DecodeEntry(bytes,i*88);if(row.Number<next)throw new InvalidOperationException("Directory not ordered; listing stopped.");rows.Add(row);next=row.Number+1;}
                if(count<batch)break;
            }return rows.ToArray();
        }finally{Marshal.FreeHGlobal(buffer);cnc_freelibhndl(handle);}
    }
    public static string ValidateReceived(byte[] bytes,int number){
        if(number<1||number>7999)throw new InvalidOperationException("Receiving supports O0001-O7999 in this trial.");
        if(bytes==null||bytes.Length<8||bytes.Length>2*1024*1024)throw new InvalidOperationException("Incomplete or oversized CNC program.");
        foreach(byte b in bytes)if(b!=9&&b!=10&&b!=13&&(b<32||b>126))throw new InvalidOperationException("Unsupported non-ASCII CNC program.");
        string text=Encoding.ASCII.GetString(bytes).Replace("\r\n","\n").Replace("\r","\n").Trim();
        if(!text.StartsWith("%")||!text.EndsWith("%")||text.Split('%').Length!=3)throw new InvalidOperationException("Incomplete NC envelope or additional macro export; file not saved.");
        int depth=0;foreach(char ch in text){if(ch=='('&&++depth>1)throw new InvalidOperationException("Nested comments unsupported.");if(ch==')'&&--depth<0)throw new InvalidOperationException("Invalid comments.");}if(depth!=0)throw new InvalidOperationException("Incomplete comments.");
        string code=Regex.Replace(text,@"\([^)]*\)","",RegexOptions.Singleline).Trim().Trim('%').Trim();
        MatchCollection found=Regex.Matches(code,@"(?m)^\s*O([0-9]{1,8})(?=[^0-9]|$)");
        if(found.Count!=1||Regex.Matches(code,@"(?<![A-Z])O\s*[0-9]+",RegexOptions.IgnoreCase).Count!=1||int.Parse(found[0].Groups[1].Value)!=number||!Regex.IsMatch(code,@"^O[0-9]{1,8}(?=[^0-9]|$)"))throw new InvalidOperationException("Received O-number differs from selection.");
        return text;
    }
    public static byte[] Receive(string ip,ushort port,string library,int number){
        if(number<1||number>7999)throw new InvalidOperationException("Select O0001-O7999.");
        ushort handle=Open(ip,port,library);bool started=false,ended=false;
        try{
            Check("Start CNC to PC read",cnc_upstart3(handle,0,number,number));started=true;
            using(MemoryStream output=new MemoryStream()){
                byte[] buffer=new byte[4096];DateTime deadline=DateTime.UtcNow.AddSeconds(90);
                while(true){
                    if(DateTime.UtcNow>deadline)throw new TimeoutException("CNC receive timeout; incomplete file not saved.");
                    int count=buffer.Length;short code=cnc_upload3(handle,ref count,buffer);
                    if(code==10){Thread.Sleep(20);continue;}
                    if(code==-2)break;Check("Read CNC program",code);
                    if(count<0||count>buffer.Length)throw new InvalidOperationException("Invalid CNC upload byte count.");
                    if(count==0){Thread.Sleep(20);continue;}
                    if(output.Length+count>2*1024*1024)throw new InvalidOperationException("CNC program exceeds 2 MiB; no partial file saved.");
                    output.Write(buffer,0,count);
                }
                // upend3 can return delayed protection/data errors: never save before it succeeds.
                short endCode=cnc_upend3(handle);ended=true;Check("Finish CNC to PC read",endCode);
                byte[] bytes=output.ToArray();ValidateReceived(bytes,number);return bytes;
            }
        }finally{try{if(started&&!ended)cnc_upend3(handle);}finally{cnc_freelibhndl(handle);}}
    }
    public static void SaveReceived(string path,byte[] bytes,int number){
        ValidateReceived(bytes,number);
        // CreateNew prevents overwriting any local file, even if it appears after the dialog.
        bool created=false;
        try{using(FileStream stream=new FileStream(path,FileMode.CreateNew,FileAccess.Write,FileShare.None)){created=true;stream.Write(bytes,0,bytes.Length);stream.Flush();}}
        catch{if(created){try{File.Delete(path);}catch{}}throw;}
    }
    public static Task<Operation> RunAsync(string kind,string ip,ushort port,string library,string file,string hash,string confirmation,int number){
        Interlocked.Exchange(ref progress,0);
        return Task.Run(()=>{
            if(kind=="list")return new Operation{Kind=kind,Programs=ListPrograms(ip,port,library),Message="Đã đọc danh sách bộ nhớ CNC."};
            if(kind=="inspect")return new Operation{Kind=kind,Message=Inspect(ip,port,library,file)};
            if(kind=="send")return new Operation{Kind=kind,Message=Send(ip,port,library,file,hash,confirmation)};
            if(kind=="receive"){byte[] bytes=Receive(ip,port,library,number);SaveReceived(file,bytes,number);return new Operation{Kind=kind,Text=Encoding.ASCII.GetString(bytes),Destination=file,Message="Đã nhận O"+number.ToString("D4")+" về máy tính."};}
            if(kind=="preview"){byte[] bytes=Receive(ip,port,library,number);return new Operation{Kind=kind,Text=Encoding.ASCII.GetString(bytes),Message="Nội dung đọc từ bộ nhớ CNC."};}
            throw new ArgumentException("Unknown operation.");
        });
    }

}
