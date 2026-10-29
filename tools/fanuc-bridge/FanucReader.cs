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
    public sealed class Snapshot
    {
        public string timestampUtc, ip, cncType, machineType, series, version, axes;
        public int port, maximumAxes;
        public Status rawStatus;
        public double? spindleSpeed, feedrate;
        public int? partCounter;
        public long? runTimeMs, cycleTimeMs;
        public bool pmcEnabled;
        public int cycleStartBit=-1,m30Bit=-1;
        public string pmcStatus;
        public PmcEvent[] pmcEvents;
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

    public sealed class PmcEvent {
        public string kind, atUtc, message;
        public Snapshot sample;
    }
    private static readonly System.Collections.Concurrent.ConcurrentQueue<PmcEvent> PmcQueue = new System.Collections.Concurrent.ConcurrentQueue<PmcEvent>();
    private static System.Threading.Thread pmcThread;
    private static volatile bool pmcStop;
    private static volatile string pmcMessage = "Not started";
    private static volatile int startBitValue = -1, endBitValue = -1;
    private static int eventCount;
    [DllImport("Fwlib64.dll", CallingConvention = CallingConvention.Winapi, ExactSpelling = true)]
    private static extern short pmc_rdpmcrng(ushort handle, short area, short dataType, ushort start, ushort end, ushort length, [Out] byte[] data);
    public static bool DecodePmcBit(byte[] data, int bit) {
        if(data == null || data.Length < 9 || bit < 0 || bit > 7) throw new ArgumentException("Invalid PMC bit buffer");
        return (data[8] & (1 << bit)) != 0;
    }
    private static bool ReadPmcBit(ushort handle, short area, ushort address, int bit) {
        byte[] buffer = new byte[12];
        Check("pmc_rdpmcrng", pmc_rdpmcrng(handle,area,0,address,address,9,buffer));
        return DecodePmcBit(buffer,bit);
    }
    private static void QueuePmc(string kind, string at, Snapshot sample, string message) {
        // A long blocked main loop must not consume unbounded memory or silently hide dropped events.
        if(System.Threading.Interlocked.Increment(ref eventCount)>20000) {
            PmcEvent discarded; while(PmcQueue.TryDequeue(out discarded)) { }
            System.Threading.Interlocked.Exchange(ref eventCount,0);
            PmcQueue.Enqueue(new PmcEvent {kind="gap",atUtc=at,message="PMC event queue overflow"});
        }
        PmcQueue.Enqueue(new PmcEvent {kind=kind,atUtc=at,sample=sample,message=message});
    }
    public static PmcEvent[] DrainPmcEvents() {
        var events = new List<PmcEvent>(); PmcEvent item;
        while(PmcQueue.TryDequeue(out item)) events.Add(item);
        System.Threading.Interlocked.Exchange(ref eventCount,0);
        return events.ToArray();
    }
    public static void StartPmcMonitor(string ip, ushort port, int pollMilliseconds) {
        if(pollMilliseconds<100 || pollMilliseconds>1000) throw new ArgumentException("PMC interval must be 100..1000 ms");
        if(pmcThread!=null) throw new InvalidOperationException("PMC monitor already started; use only one bridge");
        pmcStop=false; DrainPmcEvents();
        pmcThread=new System.Threading.Thread(()=>MonitorPmc(ip,port,pollMilliseconds));
        pmcThread.IsBackground=true;pmcThread.Name="Read-only X10.1 / R423.6";pmcThread.Start();
    }
    public static void StopPmcMonitor() {
        pmcStop=true;
        if(pmcThread!=null && pmcThread.Join(15000))pmcThread=null;
    }
    private static Snapshot PmcSnapshot(ushort handle, Status status, bool full) {
        var result=new Snapshot {timestampUtc=DateTime.UtcNow.ToString("o"),rawStatus=status};
        if(full) ReadOptionalTelemetry(handle,result);
        else {
            CounterParameter counter;
            short rc=cnc_rdparam(handle,6711,0,8,out counter);
            if(rc==0 && counter.datano==6711 && counter.value>=0)result.partCounter=counter.value;
            ProgramReading8 program;
            try { if(cnc_rdprgnumo8(handle,out program)==0) result.mainProgram=ProgramNumber(program.mdata); }
            catch(EntryPointNotFoundException) { }
        }
        return result;
    }
    private static void MonitorPmc(string ip, ushort port, int interval) {
        while(!pmcStop) {
            ushort handle=0; bool allocated=false;
            try {
                Check("PMC connection",cnc_allclibhndl3(ip,port,2,out handle)); allocated=true;
                bool? previousStart=null,previousEnd=null; DateTime lastState=DateTime.MinValue;
                while(!pmcStop) {
                    bool start=ReadPmcBit(handle,3,10,1);   // X10.1: user-supplied Cycle Start input.
                    bool end=ReadPmcBit(handle,5,423,6);    // R0423.6: user-supplied M30 internal relay.
                    string at=DateTime.UtcNow.ToString("o");
                    bool startEdge=previousStart.HasValue && !previousStart.Value && start;
                    bool endEdge=previousEnd.HasValue && !previousEnd.Value && end;
                    startBitValue=start?1:0;endBitValue=end?1:0;pmcMessage="Reading PMC (sampled; short pulses may be missed)";
                    if(startEdge || endEdge || (DateTime.UtcNow-lastState).TotalSeconds>=1) {
                        Status status;Check("PMC status",cnc_statinfo(handle,out status));
                        Snapshot sample=PmcSnapshot(handle,status,startEdge||endEdge);
                        if(startEdge&&endEdge)QueuePmc("gap",at,null,"Cycle Start and M30 both changed between samples; order unknown");
                        else if(startEdge)QueuePmc("start",at,sample,null);
                        else if(endEdge)QueuePmc("end",at,sample,null);
                        else QueuePmc("state",at,sample,null);
                        lastState=DateTime.UtcNow;
                    }
                    previousStart=start;previousEnd=end;
                    System.Threading.Thread.Sleep(interval);
                }
            } catch(Exception error) {
                pmcMessage=error is EntryPointNotFoundException?"PMC API missing in DLL":error.Message;
                QueuePmc("gap",DateTime.UtcNow.ToString("o"),null,pmcMessage);
                startBitValue=-1;endBitValue=-1;
                if(!pmcStop)System.Threading.Thread.Sleep(1000);
            } finally { if(allocated)cnc_freelibhndl(handle); }
        }
    }

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
            snapshot.pmcEnabled=pmcThread!=null;
            snapshot.pmcEvents=DrainPmcEvents();
            snapshot.cycleStartBit=startBitValue;snapshot.m30Bit=endBitValue;snapshot.pmcStatus=pmcMessage;
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
