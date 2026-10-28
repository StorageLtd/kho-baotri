using System;
using System.ComponentModel;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

// Read-only FOCAS probe. Structures follow the uploaded FS30D Fwlib64.h.
public static class FanucReader
{
    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    public struct SysInfo
    {
        public short addinfo, max_axis;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 2)] public byte[] cnc_type;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 2)] public byte[] mt_type;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 4)] public byte[] series;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 4)] public byte[] version;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 2)] public byte[] axes;
    }
    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    public struct Status
    {
        public short hdck, tmmode, aut, run, motion, mstb, emergency, alarm, edit;
    }
    public sealed class Snapshot
    {
        public string timestampUtc, ip, cncType, machineType, series, version, axes;
        public int port, maximumAxes;
        public Status rawStatus;
    }

    [DllImport("kernel32.dll", EntryPoint = "LoadLibraryExW", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr LoadLibraryEx(string path, IntPtr reserved, uint flags);
    [DllImport("Fwlib64.dll", CallingConvention = CallingConvention.Winapi, CharSet = CharSet.Ansi, ExactSpelling = true)]
    private static extern short cnc_allclibhndl3(string ip, ushort port, int timeout, out ushort handle);
    [DllImport("Fwlib64.dll", CallingConvention = CallingConvention.Winapi, ExactSpelling = true)]
    private static extern short cnc_sysinfo(ushort handle, out SysInfo info);
    [DllImport("Fwlib64.dll", CallingConvention = CallingConvention.Winapi, ExactSpelling = true)]
    private static extern short cnc_statinfo(ushort handle, out Status status);
    [DllImport("Fwlib64.dll", CallingConvention = CallingConvention.Winapi, ExactSpelling = true)]
    private static extern short cnc_freelibhndl(ushort handle);

    private static string Text(byte[] value) { return Encoding.ASCII.GetString(value).TrimEnd('\0', ' '); }
    private static void Check(string operation, short code)
    {
        if (code == 0) return;
        string hint;
        switch (code)
        {
            case -17: hint = "FOCAS protocol error."; break;
            case -16: hint = "Network/socket error. Check CNC IP, Ethernet cable and TCP port."; break;
            case -15: hint = "Missing FOCAS DLL or dependency; keep the matching DLL set in lib."; break;
            case -8: hint = "Invalid connection handle."; break;
            case -7: hint = "Library/CNC version mismatch."; break;
            case -1: hint = "CNC busy. Retry later."; break;
            case 6: hint = "Required option is unavailable for this operation."; break;
            default: hint = "Keep this exact code for diagnosis; do not change CNC parameters."; break;
        }
        throw new InvalidOperationException(operation + " returned FOCAS code " + code + ". " + hint);
    }
    public static Snapshot Read(string ip, ushort port, string libraryDirectory)
    {
        if (IntPtr.Size != 8) throw new InvalidOperationException("Use 64-bit Windows PowerShell.");
        if (Marshal.SizeOf(typeof(SysInfo)) != 18 || Marshal.SizeOf(typeof(Status)) != 18)
            throw new InvalidOperationException("FOCAS structure size mismatch; connection cancelled.");
        // Preload exact supplied files. Search dependencies only beside the DLL or in safe Windows directories.
        foreach (string name in new string[] { "fwlibe64.dll", "fwlib30i64.dll", "Fwlib64.dll" })
        {
            string path = Path.GetFullPath(Path.Combine(libraryDirectory, name));
            if (!File.Exists(path)) throw new FileNotFoundException("Missing library", path);
            if (LoadLibraryEx(path, IntPtr.Zero, 0x00000100 | 0x00001000) == IntPtr.Zero)
                throw new Win32Exception(Marshal.GetLastWin32Error(), "Cannot load " + name);
        }
        ushort handle;
        // Native Windows 'long' is 32-bit even in this x64 API; timeout is seconds.
        Check("cnc_allclibhndl3", cnc_allclibhndl3(ip, port, 10, out handle));
        try
        {
            SysInfo info; Status status;
            Check("cnc_sysinfo", cnc_sysinfo(handle, out info));
            Check("cnc_statinfo", cnc_statinfo(handle, out status));
            return new Snapshot {
                timestampUtc = DateTime.UtcNow.ToString("o"), ip = ip, port = port,
                cncType = Text(info.cnc_type), machineType = Text(info.mt_type),
                series = Text(info.series), version = Text(info.version), axes = Text(info.axes),
                maximumAxes = info.max_axis, rawStatus = status
            };
        }
        finally
        {
            short result = cnc_freelibhndl(handle);
            if (result != 0) Console.Error.WriteLine("Disconnect returned FOCAS code " + result);
        }
    }
}
