using System;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;

// Separate, explicitly confirmed program download trial. Not used by monitoring bridges.
public static class FanucProgramTransfer
{
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
        if(programs.Count!=1 || Regex.Matches(code,@"O\s*[0-9]+",RegexOptions.IgnoreCase).Count!=1)throw new InvalidOperationException("Trial accepts exactly one O-number program, no bundled subprograms.");
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
        // Reuse the established, read-only loader to load DLLs from this package's lib only.
        FanucReader.Read(ip,port,library);
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
            int position=0;DateTime deadline=DateTime.UtcNow.AddSeconds(90);
            while(position<selected.Bytes.Length){
                if(DateTime.UtcNow>deadline)throw new TimeoutException("Transfer timeout. Do not retry automatically; inspect CNC program memory first.");
                int length=Math.Min(4096,selected.Bytes.Length-position);byte[] part=new byte[length];Buffer.BlockCopy(selected.Bytes,position,part,0,length);
                short code=cnc_download3(handle,ref length,part);
                if(code==10){Thread.Sleep(50);continue;}
                Check("Transfer data",code);
                if(length<=0 || length>part.Length)throw new InvalidOperationException("Invalid accepted byte count; transfer stopped.");
                position+=length;
            }
            Check("Finish transfer",cnc_dwnend3(handle));finished=true;
            return "CNC accepted "+selected.Program+". Verify its full contents and offsets on the machine before running. This tool has not selected or started the program.";
        }
        catch(Exception e){throw new InvalidOperationException(e.Message+(started?" A partial program may remain on the CNC. Inspect it at the machine; this tool does not delete or retry it.":" No program transfer was started."),e);}
        finally {try{if(started&&!finished)cnc_dwnend3(handle);}finally{cnc_freelibhndl(handle);}}
    }
}
