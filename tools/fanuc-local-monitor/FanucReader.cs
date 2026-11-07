using System;
using System.ComponentModel;
using System.Collections.Generic;
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
    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    public struct SpeedElement
    {
        public int data; // Windows C long is 32-bit, including on x64.
        public short dec, unit, disp;
        public byte name, suff;
    }
    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    public struct SpeedReading { public SpeedElement actf, acts; }
    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    public struct ProgramReading { public short dummy1, dummy2; public ushort data, mdata; }
    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    public struct ProgramReading8 { public short dummy1, dummy2; public uint data, mdata; }
    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    public struct CounterParameter { public short datano, type; public int value; }
    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    public struct TimerReading { public int minute, msec; }
    // Uploaded ODBALMMSG2: Windows long=4 bytes, message starts at offset 12.
    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    public struct AlarmReading
    {
        public int number;
        public short type, axis, dummy, messageLength;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 64)] public byte[] message;
    }
    public sealed class AlarmDetail
    {
        public int number, type, axis;
        public string message;
    }
    public static AlarmDetail DecodeAlarm(AlarmReading value)
    {
        if (value.messageLength < 0 || value.messageLength > 64 || value.message == null || value.message.Length < value.messageLength)
            throw new InvalidOperationException("Invalid alarm message length");
        return new AlarmDetail { number=value.number, type=value.type, axis=value.axis,
            message=Encoding.Default.GetString(value.message,0,value.messageLength).TrimEnd('\0',' ') };
    }
    [DllImport("Fwlib64.dll", CallingConvention = CallingConvention.Winapi, ExactSpelling = true)]
    private static extern short cnc_rdalmmsg2(ushort handle, short type, ref short count, IntPtr messages);
    private static void ReadAlarms(ushort handle, Snapshot snapshot)
    {
        const int capacity=32, size=76;
        if (Marshal.SizeOf(typeof(AlarmReading)) != size) { snapshot.readErrors["alarms"]="Alarm structure size mismatch"; return; }
        IntPtr buffer=Marshal.AllocHGlobal(capacity*size);
        try {
            Marshal.Copy(new byte[capacity*size],0,buffer,capacity*size);
            short count=capacity;
            short code=cnc_rdalmmsg2(handle,-1,ref count,buffer);
            if(code!=0) { snapshot.readErrors["alarms"]="cnc_rdalmmsg2: FOCAS "+code; return; }
            if(count<0 || count>capacity) { snapshot.readErrors["alarms"]="Invalid alarm count"; return; }
            var details=new List<AlarmDetail>();
            for(int i=0;i<count;i++) {
                AlarmReading value=(AlarmReading)Marshal.PtrToStructure(IntPtr.Add(buffer,i*size),typeof(AlarmReading));
                details.Add(DecodeAlarm(value));
            }
            snapshot.alarmDetails=details.ToArray();
            snapshot.alarmDetailsRead=true;
            snapshot.alarmsMayBeTruncated=count==capacity;
        } catch(EntryPointNotFoundException) { snapshot.readErrors["alarms"]="cnc_rdalmmsg2 unavailable in this DLL"; }
          catch(InvalidOperationException error) { snapshot.readErrors["alarms"]=error.Message; }
        finally { Marshal.FreeHGlobal(buffer); }
    }
    public sealed class Snapshot
    {
        public string timestampUtc, ip, cncType, machineType, series, version, axes;
        public int port, maximumAxes;
        public Status rawStatus;
        public AlarmDetail[] alarmDetails;
        public bool alarmDetailsRead, alarmsMayBeTruncated;
        public double? spindleSpeed, feedrate;
        public int? partCounter;
        public long? runTimeMs, cycleTimeMs;
        public string timerSource;
        public string spindleUnit, feedrateUnit, activeProgram, mainProgram;
        public Dictionary<string, string> readErrors = new Dictionary<string, string>();
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

    [DllImport("Fwlib64.dll", CallingConvention = CallingConvention.Winapi, ExactSpelling = true)]
    private static extern short cnc_rdspeed(ushort handle, short type, out SpeedReading speed);
    [DllImport("Fwlib64.dll", CallingConvention = CallingConvention.Winapi, ExactSpelling = true)]
    private static extern short cnc_rdprgnumo8(ushort handle, out ProgramReading8 program);
    [DllImport("Fwlib64.dll", CallingConvention = CallingConvention.Winapi, ExactSpelling = true)]
    private static extern short cnc_rdprgnum(ushort handle, out ProgramReading program);

    // Parameter 6711: CNC machined-parts counter. Read only; never write/reset it.
    [DllImport("Fwlib64.dll", CallingConvention = CallingConvention.Winapi, ExactSpelling = true)]
    private static extern short cnc_rdparam(ushort handle, short number, short axis, short length, out CounterParameter parameter);

    [DllImport("Fwlib64.dll", CallingConvention = CallingConvention.Winapi, ExactSpelling = true)]
    private static extern short cnc_rdtimer(ushort handle, short type, out TimerReading timer);
    public static long? TimerMilliseconds(TimerReading timer)
    {
        return timer.minute >= 0 && timer.minute <= 999999999 && timer.msec >= 0 && timer.msec < 60000
            ? (long?)((long)timer.minute * 60000L + timer.msec) : null;
    }
    private static long? ReadTimer(ushort handle, short type, short minutesParameter, short millisecondsParameter, Snapshot snapshot, string key)
    {
        try {
            TimerReading timer;
            short code = cnc_rdtimer(handle, type, out timer);
            if (code == 0) {
                long? value = TimerMilliseconds(timer);
                if (value.HasValue) return value;
            }
        } catch (EntryPointNotFoundException) { }
        // 0i-F/30i operating and cycle timers: read minute/millisecond parameter pairs, never write them.
        CounterParameter before, milliseconds, after;
        short a=cnc_rdparam(handle,minutesParameter,0,8,out before);
        short b=cnc_rdparam(handle,millisecondsParameter,0,8,out milliseconds);
        short c=cnc_rdparam(handle,minutesParameter,0,8,out after);
        if(a==0 && b==0 && c==0 && before.datano==minutesParameter && after.datano==minutesParameter && milliseconds.datano==millisecondsParameter) {
            if(before.value != after.value) b=cnc_rdparam(handle,millisecondsParameter,0,8,out milliseconds);
            long? result = b==0 ? TimerMilliseconds(new TimerReading { minute=after.value,msec=milliseconds.value }) : null;
            if(result.HasValue) { snapshot.timerSource="CNC timer / parameter pairs 6752+6751, 6758+6757"; return result; }
        }
        snapshot.readErrors[key]="Timer unavailable; confirm CNC timer mapping/support ("+minutesParameter+"/"+millisecondsParameter+")";
        return null;
    }

    public static string AccessMode { get { return "FOCAS_STATUS_ONLY_V1"; } }

    public static string SpeedUnit(short unit)
    {
        switch (unit) {
            case 0: return "mm/min"; case 1: return "inch/min"; case 2: return "rpm";
            case 3: return "mm/rev"; case 4: return "inch/rev"; default: return null;
        }
    }
    public static double? ScaledSpeed(SpeedElement element, byte expectedName)
    {
        if (element.name != expectedName || element.dec < 0 || element.dec > 9 ||
            element.data < 0 || SpeedUnit(element.unit) == null) return null;
        return element.data / Math.Pow(10, element.dec);
    }
    public static void ApplySpeed(short result, SpeedReading speed, Snapshot snapshot)
    {
        snapshot.spindleSpeed = null; snapshot.feedrate = null;
        snapshot.spindleUnit = null; snapshot.feedrateUnit = null;
        if (result != 0) { snapshot.readErrors["speed"] = "cnc_rdspeed: FOCAS " + result; return; }
        snapshot.spindleSpeed = ScaledSpeed(speed.acts, (byte)'S');
        snapshot.feedrate = ScaledSpeed(speed.actf, (byte)'F');
        if (snapshot.spindleSpeed.HasValue && speed.acts.unit == 2) snapshot.spindleUnit = "rpm";
        else { snapshot.spindleSpeed = null; snapshot.readErrors["spindle"] = "Invalid spindle data/unit"; }
        if (snapshot.feedrate.HasValue) snapshot.feedrateUnit = SpeedUnit(speed.actf.unit);
        else snapshot.readErrors["feed"] = "Invalid feed data/unit";
    }
    public static string ProgramNumber(uint number)
    {
        return number > 0 && number <= 99999999 ? "O" + number.ToString("D4") : null;
    }
    private static void ReadOptionalTelemetry(ushort handle, Snapshot snapshot)
    {
        try {
            SpeedReading speed;
            short result = cnc_rdspeed(handle, -1, out speed);
            ApplySpeed(result, speed, snapshot);
        } catch (EntryPointNotFoundException) { snapshot.readErrors["speed"] = "cnc_rdspeed unavailable in this DLL"; }
        try {
            CounterParameter counter;
            short code = cnc_rdparam(handle, 6711, 0, 8, out counter);
            if (code == 0 && counter.datano == 6711 && counter.value >= 0) snapshot.partCounter = counter.value;
            else snapshot.readErrors["parts"] = "cnc_rdparam(6711): " + (code == 0 ? "Invalid counter data" : "FOCAS " + code);
        } catch (EntryPointNotFoundException) { snapshot.readErrors["parts"] = "Counter API unavailable in this DLL"; }
        try {
            snapshot.runTimeMs=ReadTimer(handle,1,6752,6751,snapshot,"runTime");
            snapshot.cycleTimeMs=ReadTimer(handle,3,6758,6757,snapshot,"cycleTime");
        } catch (EntryPointNotFoundException) { snapshot.readErrors["timers"]="Timer APIs unavailable in this DLL"; }
        bool useFourDigits = false;
        try {
            ProgramReading8 program;
            short result = cnc_rdprgnumo8(handle, out program);
            if (result == 0) { snapshot.activeProgram = ProgramNumber(program.data); snapshot.mainProgram = ProgramNumber(program.mdata); }
            else if (result == 1) useFourDigits = true;
            else snapshot.readErrors["program"] = "cnc_rdprgnumo8: FOCAS " + result;
        } catch (EntryPointNotFoundException) { useFourDigits = true; }
        if (useFourDigits) {
            try {
                ProgramReading program;
                short result = cnc_rdprgnum(handle, out program);
                if (result == 0) { snapshot.activeProgram = ProgramNumber(program.data); snapshot.mainProgram = ProgramNumber(program.mdata); }
                else snapshot.readErrors["program"] = "cnc_rdprgnum: FOCAS " + result;
            } catch (EntryPointNotFoundException) { snapshot.readErrors["program"] = "Program-number API unavailable in this DLL"; }
        }
    }

    private static readonly object LibraryLock = new object();
    private static string loadedDirectory;

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
        if (Marshal.SizeOf(typeof(SysInfo)) != 18 || Marshal.SizeOf(typeof(Status)) != 18 ||
            Marshal.SizeOf(typeof(SpeedElement)) != 12 || Marshal.SizeOf(typeof(SpeedReading)) != 24 ||
            Marshal.SizeOf(typeof(ProgramReading)) != 8 || Marshal.SizeOf(typeof(ProgramReading8)) != 12 || Marshal.SizeOf(typeof(CounterParameter)) != 8 || Marshal.SizeOf(typeof(TimerReading)) != 8)
            throw new InvalidOperationException("FOCAS structure size mismatch; connection cancelled.");
        // Load the supplied DLLs once, not on every poll (LoadLibrary increments native reference counts).
        string fullDirectory = Path.GetFullPath(libraryDirectory);
        lock (LibraryLock)
        {
            if (loadedDirectory != null && !String.Equals(loadedDirectory, fullDirectory, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Restart PowerShell before selecting another library directory.");
            if (loadedDirectory == null)
            {
                foreach (string name in new string[] { "fwlibe64.dll", "fwlib30i64.dll", "Fwlib64.dll" })
                {
                    string path = Path.Combine(fullDirectory, name);
                    if (!File.Exists(path)) throw new FileNotFoundException("Missing library", path);
                    if (LoadLibraryEx(path, IntPtr.Zero, 0x00000100 | 0x00001000) == IntPtr.Zero)
                        throw new Win32Exception(Marshal.GetLastWin32Error(), "Cannot load " + name);
                }
                loadedDirectory = fullDirectory;
            }
        }
        ushort handle;
        // Native Windows 'long' is 32-bit even in this x64 API; timeout is seconds.
        Check("cnc_allclibhndl3", cnc_allclibhndl3(ip, port, 10, out handle));
        try
        {
            SysInfo info; Status status;
            Check("cnc_sysinfo", cnc_sysinfo(handle, out info));
            Check("cnc_statinfo", cnc_statinfo(handle, out status));
            Snapshot snapshot = new Snapshot {
                timestampUtc = DateTime.UtcNow.ToString("o"), ip = ip, port = port,
                cncType = Text(info.cnc_type), machineType = Text(info.mt_type),
                series = Text(info.series), version = Text(info.version), axes = Text(info.axes),
                maximumAxes = info.max_axis, rawStatus = status
            };
            ReadOptionalTelemetry(handle, snapshot);
            ReadAlarms(handle, snapshot);
            snapshot.timestampUtc=DateTime.UtcNow.ToString("o");
            return snapshot;
        }
        finally
        {
            short result = cnc_freelibhndl(handle);
            if (result != 0) Console.Error.WriteLine("Disconnect returned FOCAS code " + result);
        }
    }
}
