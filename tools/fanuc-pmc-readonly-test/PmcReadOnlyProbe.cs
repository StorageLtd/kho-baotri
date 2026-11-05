using System;
using System.ComponentModel;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;

// Standalone test: only the two user-supplied PMC byte addresses are readable.
// IODBPMC header and pmc_rdpmcrng signature follow the uploaded Fwlib64.h.
public sealed class PmcReadOnlyProbe : IDisposable
{
    public static string AccessMode { get { return "FIXED_PMC_READ_ONLY_X10_R423_V1"; } }
    public sealed class Sample
    {
        public string startedUtc, xReadUtc, rReadUtc, finishedUtc;
        public byte x10Byte, r423Byte;
        public bool x10Bit1, r423Bit6;
    }
    [DllImport("kernel32.dll", EntryPoint="LoadLibraryExW", CharSet=CharSet.Unicode, SetLastError=true)]
    private static extern IntPtr LoadLibraryEx(string path, IntPtr reserved, uint flags);
    [DllImport("Fwlib64.dll", CallingConvention=CallingConvention.Winapi, CharSet=CharSet.Ansi, ExactSpelling=true)]
    private static extern short cnc_allclibhndl3(string ip, ushort port, int timeout, out ushort handle);
    [DllImport("Fwlib64.dll", CallingConvention=CallingConvention.Winapi, ExactSpelling=true)]
    private static extern short pmc_rdpmcrng(ushort handle, short area, short dataType, ushort start, ushort end, ushort length, IntPtr data);
    [DllImport("Fwlib64.dll", CallingConvention=CallingConvention.Winapi, ExactSpelling=true)]
    private static extern short cnc_freelibhndl(ushort handle);

    private static readonly object LibraryLock=new object();
    private static string loadedDirectory;
    private ushort handle;
    private bool disposed;
    private PmcReadOnlyProbe(ushort value) { handle=value; }
    public static PmcReadOnlyProbe Open(string ip, ushort port, string libraryDirectory)
    {
        if(IntPtr.Size!=8 || Environment.OSVersion.Platform!=PlatformID.Win32NT)
            throw new InvalidOperationException("Use 64-bit Windows PowerShell on Windows.");
        IPAddress address;
        if(!IPAddress.TryParse(ip,out address) || address.AddressFamily!=System.Net.Sockets.AddressFamily.InterNetwork || port==0)
            throw new ArgumentException("Enter a valid CNC IPv4 address and TCP port.");
        string directory=Path.GetFullPath(libraryDirectory);
        lock(LibraryLock) {
            if(loadedDirectory!=null && !String.Equals(directory,loadedDirectory,StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Close PowerShell before choosing another library directory.");
            if(loadedDirectory==null) {
                foreach(string name in new string[]{"fwlibe64.dll","fwlib30i64.dll","Fwlib64.dll"}) {
                    string path=Path.Combine(directory,name);
                    if(!File.Exists(path))throw new FileNotFoundException("Missing library",path);
                    if(LoadLibraryEx(path,IntPtr.Zero,0x00000100|0x00001000)==IntPtr.Zero)
                        throw new Win32Exception(Marshal.GetLastWin32Error(),"Cannot load "+name);
                }
                loadedDirectory=directory;
            }
        }
        ushort value;
        Check("cnc_allclibhndl3",cnc_allclibhndl3(ip,port,3,out value));
        return new PmcReadOnlyProbe(value);
    }
    private static void Check(string operation, short result)
    {
        if(result!=0)throw new InvalidOperationException(operation+" returned FOCAS "+result+". Test stopped; do not change CNC/PMC parameters to bypass this error.");
    }
    public static byte DecodeByte(byte[] bytes, short area, ushort address)
    {
        if(!((area==3 && address==10)||(area==5 && address==423)))
            throw new ArgumentException("Only X10 and R423 are allowed by this test.");
        if(bytes==null || bytes.Length<9 || BitConverter.ToInt16(bytes,0)!=area || BitConverter.ToInt16(bytes,2)!=0 ||
            BitConverter.ToUInt16(bytes,4)!=address || BitConverter.ToUInt16(bytes,6)!=address)
            throw new InvalidOperationException("Invalid PMC reply header; no signal value accepted.");
        return bytes[8];
    }
    private byte ReadFixedByte(short area, ushort address)
    {
        if(disposed)throw new ObjectDisposedException("PmcReadOnlyProbe");
        if(!((area==3 && address==10)||(area==5 && address==423)))throw new ArgumentException("Unsupported address");
        IntPtr buffer=Marshal.AllocHGlobal(32);
        try {
            Marshal.Copy(new byte[32],0,buffer,32);
            // Byte data: 8-byte header + exactly 1 byte; no address-range scan.
            Check("pmc_rdpmcrng",pmc_rdpmcrng(handle,area,0,address,address,9,buffer));
            byte[] bytes=new byte[9];Marshal.Copy(buffer,bytes,0,9);
            return DecodeByte(bytes,area,address);
        } finally { Marshal.FreeHGlobal(buffer); }
    }
    public Sample Read()
    {
        Sample sample=new Sample { startedUtc=DateTime.UtcNow.ToString("o") };
        sample.x10Byte=ReadFixedByte(3,10);sample.xReadUtc=DateTime.UtcNow.ToString("o");
        sample.r423Byte=ReadFixedByte(5,423);sample.rReadUtc=DateTime.UtcNow.ToString("o");
        sample.x10Bit1=(sample.x10Byte & 0x02)!=0;
        sample.r423Bit6=(sample.r423Byte & 0x40)!=0;
        sample.finishedUtc=DateTime.UtcNow.ToString("o");
        return sample;
    }
    public void Dispose()
    {
        if(disposed)return;
        disposed=true;
        short result=cnc_freelibhndl(handle);
        if(result!=0)Console.Error.WriteLine("Disconnect returned FOCAS "+result);
    }
}
