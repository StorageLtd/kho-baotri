using System;
using System.ComponentModel;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

// Read-only FOCAS probe. Structures follow the uploaded FS30D Fwlib64.h.
public static class FanucReader
{
    public static string ReaderBuild {get{return "20261109-input-precision";}}
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
    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    public struct MacroReading { public short datano, dummy; public int value; public short decimals; }
    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    public struct ModalTool { public short datano, type; public int value; public byte flag1, flag2; public short padding; }
    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    public struct OffsetInfo { public short memoryType, count; }
    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    public struct OffsetReading { public short number, type; public int value; }
    public sealed class MachiningContext
    {
        public string sampledAtUtc, toolSource, workCoordinate, unit, offsetSource, profile;
        public int? toolNumber, spindleToolNumber, nextToolNumber, commandedToolNumber, lengthOffsetNumber, radiusOffsetNumber;
        public double? workX, workY, workZ, lengthGeometry, lengthWear, radiusGeometry, radiusWear;
        public bool spindleToolConfirmed;
    }
    [DllImport("Fwlib64.dll", CallingConvention=CallingConvention.Winapi, ExactSpelling=true)]
    private static extern short cnc_modal(ushort handle, short type, short block, IntPtr data);
    [DllImport("Fwlib64.dll", CallingConvention=CallingConvention.Winapi, ExactSpelling=true)]
    private static extern short cnc_rdaxisname(ushort handle,ref short count,[Out] byte[] names);
    [DllImport("Fwlib64.dll", CallingConvention=CallingConvention.Winapi, ExactSpelling=true)]
    private static extern short cnc_rdmacro(ushort handle, short number, short length, out MacroReading data);
    [DllImport("Fwlib64.dll", CallingConvention=CallingConvention.Winapi, ExactSpelling=true)]
    private static extern short cnc_rdtofsinfo(ushort handle, out OffsetInfo data);
    [DllImport("Fwlib64.dll", CallingConvention=CallingConvention.Winapi, ExactSpelling=true)]
    private static extern short cnc_rdtofs(ushort handle, short number, short type, short length, out OffsetReading data);
    [DllImport("Fwlib64.dll", CallingConvention=CallingConvention.Winapi, ExactSpelling=true)]
    private static extern short cnc_getfigure(ushort handle, short type, out short valid, [Out] short[] input, [Out] short[] output);
    public static double? MacroValue(MacroReading value)
    {
        if(value.decimals<0 || value.decimals>9 || value.value==Int32.MinValue) return null;
        return value.value/Math.Pow(10,value.decimals);
    }
    private static double? ReadMacro(ushort handle,short number)
    {
        MacroReading value;
        return cnc_rdmacro(handle,number,10,out value)==0 && value.datano==number ? MacroValue(value):null;
    }
    private static int? IntegerCode(double? value)
    {
        return value.HasValue && value.Value>=0 && value.Value<=32767 && value.Value==Math.Floor(value.Value)?(int?)value.Value:null;
    }
    // cnc_rdtofs single-value types differ from cnc_rdtofsr range-column types.
    // SDK Ncdata/cnc_rdtofs.xml: radius wear=0, radius geometry=1, length wear=2, length geometry=3.
    public static short SingleOffsetType(int memory,int column)
    {
        if(column<0||column>3)return -1;
        if(memory==2)return new short[]{3,2,1,0}[column];
        if(memory==1)return new short[]{1,0,1,0}[column];
        if(memory==0)return column==0||column==2?(short)0:(short)-1;
        return -1;
    }
    private static double? ReadOffset(ushort handle,int? number,short type,int decimals,int limit)
    {
        if(type<0 || !number.HasValue || number.Value<1 || number.Value>limit) return null;
        OffsetReading value;
        return cnc_rdtofs(handle,(short)number.Value,type,8,out value)==0 && value.number==number.Value && value.type==type && value.value!=Int32.MinValue ? (double?)(value.value/Math.Pow(10,decimals)):null;
    }
    public static string NormalizeCncText(byte[] value)
    { return value==null?String.Empty:Encoding.ASCII.GetString(value).Trim('\0',' '); }
    private static bool IsThreeAxisMill(Snapshot snapshot)
    {
        int axes;
        return snapshot!=null&&String.Equals((snapshot.machineType??String.Empty).Trim('\0',' '),"M",StringComparison.Ordinal)&&Int32.TryParse((snapshot.axes??String.Empty).Trim('\0',' '),System.Globalization.NumberStyles.None,System.Globalization.CultureInfo.InvariantCulture,out axes)&&axes==3;
    }
    public static bool SupportsContextProfile(Snapshot snapshot,bool verified)
    { return verified&&IsThreeAxisMill(snapshot); }
    private static string ProfileIdentity(Snapshot snapshot)
    { return "reported type='"+snapshot.machineType+"', axes='"+snapshot.axes+"'"; }
    private static string PositionUnit(Snapshot snapshot)
    {
        if(snapshot.positions==null)return null;
        string result=null;int found=0;
        foreach(string name in new string[]{"X","Y","Z"}){
            AxisPosition axis=null;foreach(AxisPosition candidate in snapshot.positions)if(candidate.axis==name){axis=candidate;break;}
            string unit=axis==null||axis.machine==null?null:axis.machine.unit;
            if(unit!="mm"&&unit!="inch")return null;
            if(result!=null&&result!=unit)return null;result=unit;found++;
        }return found==3?result:null;
    }
    private static int? ReadModalNumber(ushort handle,short type)
    {
        IntPtr buffer=Marshal.AllocHGlobal(4+96*8);
        try{Marshal.Copy(new byte[4+96*8],0,buffer,4+96*8);if(cnc_modal(handle,type,0,buffer)!=0)return null;ModalTool value=(ModalTool)Marshal.PtrToStructure(buffer,typeof(ModalTool));return value.datano==type&&value.value>=0?(int?)value.value:null;}
        catch(EntryPointNotFoundException){return null;}finally{Marshal.FreeHGlobal(buffer);}
    }
    private static string ActiveWorkCoordinate(Snapshot snapshot)
    {if(snapshot.modalGcodes!=null)foreach(Gcode code in snapshot.modalGcodes)if(code.group==13)return code.code;return null;}
    private static void ReadMachiningContext(ushort handle,Snapshot snapshot,bool verifiedProfile,int expectedTable)
    {
        MachiningContext c=new MachiningContext { sampledAtUtc=DateTime.UtcNow.ToString("o"), toolSource="cnc_modal(108,0); T modal, spindle tool not confirmed", spindleToolConfirmed=false, profile=verifiedProfile?"verified-fanuc-m-3axis-memory-"+(char)('a'+expectedTable):"unverified" };
        snapshot.machiningContext=c;
        c.toolSource="cnc_rdhdnxt: HD.T / NX.T; T modal stored separately";
        try {
            int head,next;short code=cnc_rdhdnxt(handle,out head,out next);
            if(code==0){if(head>=0){c.spindleToolNumber=head;c.toolNumber=head;c.spindleToolConfirmed=true;}if(next>=0)c.nextToolNumber=next;}
            else snapshot.readErrors["tool"]="cnc_rdhdnxt: FOCAS "+code;
        }catch(EntryPointNotFoundException){snapshot.readErrors["tool"]="cnc_rdhdnxt unavailable; HD.T / NX.T not inferred from T modal";}
        try {
            IntPtr buffer=Marshal.AllocHGlobal(4+96*8);
            try {
                Marshal.Copy(new byte[4+96*8],0,buffer,4+96*8);
                if(cnc_modal(handle,108,0,buffer)==0){ModalTool t=(ModalTool)Marshal.PtrToStructure(buffer,typeof(ModalTool));if(t.datano==108&&t.value>=0)c.commandedToolNumber=t.value;}
            }finally{Marshal.FreeHGlobal(buffer);}
        }catch(EntryPointNotFoundException){}
        c.unit=PositionUnit(snapshot);c.workCoordinate=ActiveWorkCoordinate(snapshot);
        if(IsThreeAxisMill(snapshot))try{if(c.unit==null){int? u=IntegerCode(ReadMacro(handle,4006));c.unit=u==20?"inch":u==21?"mm":null;}if(c.workCoordinate==null){double? w=ReadMacro(handle,4014);if(w.HasValue)c.workCoordinate="G"+w.Value.ToString("0.###",System.Globalization.CultureInfo.InvariantCulture);}}catch(EntryPointNotFoundException){}
        if(!SupportsContextProfile(snapshot,verifiedProfile)){c.profile="unverified";snapshot.readErrors["contextProfile"]="Active H/D offset context disabled: requires a confirmed M-series XYZ / Memory A/B/C profile ("+ProfileIdentity(snapshot)+", confirmed="+verifiedProfile+")";return;}
        try {
            short axisCount=3;byte[] names=new byte[192];
            if(cnc_rdaxisname(handle,ref axisCount,names)!=0 || axisCount!=3 || names[0]!='X' || names[2]!='Y' || names[4]!='Z') {
                c.profile="unverified";snapshot.readErrors["contextProfile"]="XYZ mapping not verified by CNC axis names";return;
            }
            c.lengthOffsetNumber=ReadModalNumber(handle,104)??IntegerCode(ReadMacro(handle,4111));
            c.radiusOffsetNumber=ReadModalNumber(handle,101)??IntegerCode(ReadMacro(handle,4107));
            // Only a verified XYZ machining-centre memory A/B/C profile matching CNC readback.
            OffsetInfo info;short valid;short[] input=new short[96],output=new short[96];
            if(c.unit==null){snapshot.readErrors["toolOffsets"]="Cannot validate offset unit from CNC positions/modal";return;}
            short infoCode=cnc_rdtofsinfo(handle,out info);
            if(infoCode!=0){snapshot.readErrors["toolOffsets"]="cnc_rdtofsinfo: FOCAS "+infoCode;return;}
            if(info.memoryType!=expectedTable||info.memoryType<0||info.memoryType>2){snapshot.readErrors["toolOffsets"]="Offset table mismatch: declared="+expectedTable+", CNC="+info.memoryType;return;}
            short figureCode=cnc_getfigure(handle,1,out valid,input,output);
            if(figureCode!=0){snapshot.readErrors["toolOffsets"]="cnc_getfigure(tool precision): FOCAS "+figureCode;return;}
            if(valid<=0||input[0]<0||input[0]>9){snapshot.readErrors["toolOffsets"]="Invalid tool-offset input precision: input="+input[0]+", output="+output[0];return;}
            {
                int decimals=input[0];
                c.lengthGeometry=ReadOffset(handle,c.lengthOffsetNumber,SingleOffsetType(info.memoryType,0),decimals,info.count);
                c.lengthWear=info.memoryType==0?null:ReadOffset(handle,c.lengthOffsetNumber,SingleOffsetType(info.memoryType,1),decimals,info.count);
                c.radiusGeometry=ReadOffset(handle,c.radiusOffsetNumber,SingleOffsetType(info.memoryType,2),decimals,info.count);
                c.radiusWear=info.memoryType==0?null:ReadOffset(handle,c.radiusOffsetNumber,SingleOffsetType(info.memoryType,3),decimals,info.count);
                c.offsetSource="FOCAS memory "+(char)('A'+info.memoryType)+"; raw table values use cnc_getfigure dec_fig_in, independent of dec_fig_out";
                snapshot.toolOffsets=ReadOffsetTable(handle,info,decimals,c.unit);if(snapshot.toolOffsets==null)snapshot.readErrors["toolOffsetTable"]="Full table read unavailable or rejected by CNC";
            }
        } catch(EntryPointNotFoundException) {snapshot.readErrors["machiningContext"]="Optional macro/offset API unavailable";}
        c.sampledAtUtc=DateTime.UtcNow.ToString("o");
    }
    [DllImport("Fwlib64.dll",CallingConvention=CallingConvention.Winapi,ExactSpelling=true)]
    private static extern short cnc_upstart3(ushort handle,short type,int start,int end);
    [DllImport("Fwlib64.dll",CallingConvention=CallingConvention.Winapi,ExactSpelling=true)]
    private static extern short cnc_upload3(ushort handle,ref int length,[Out] byte[] data);
    [DllImport("Fwlib64.dll",CallingConvention=CallingConvention.Winapi,ExactSpelling=true)]
    private static extern short cnc_upend3(ushort handle);
    public sealed class FullProgram {public string program,text,sha256,sampledAtUtc;public bool complete;}
    private static FullProgram programCache;private static string programCacheKey,lastProgramAttemptKey,lastProgramFailure;private static DateTime lastProgramAttempt;
    public static bool IsCompleteProgram(string text,int number)
    {
        if(String.IsNullOrWhiteSpace(text)||text.Length>2*1024*1024||!text.TrimEnd().EndsWith("%",StringComparison.Ordinal))return false;
        System.Text.RegularExpressions.MatchCollection headers=System.Text.RegularExpressions.Regex.Matches(text,@"(?m)^[ \t\r]*O([0-9]+)(?=[^0-9]|$)");
        int parsed;return headers.Count==1&&Int32.TryParse(headers[0].Groups[1].Value,out parsed)&&parsed==number;
    }
    private static void ReadFullProgram(ushort handle,Snapshot snapshot)
    {
        int number;if(String.IsNullOrEmpty(snapshot.activeProgram)||snapshot.activeProgram[0]!='O'||!Int32.TryParse(snapshot.activeProgram.Substring(1),out number)||number<1)return;
        string key=currentReadKey+"/"+snapshot.activeProgram;
        if(programCache!=null&&programCacheKey==key&&(DateTime.UtcNow-DateTime.Parse(programCache.sampledAtUtc,null,System.Globalization.DateTimeStyles.RoundtripKind)).TotalSeconds<60){snapshot.fullProgram=programCache;return;}
        if(lastProgramAttemptKey==key&&(DateTime.UtcNow-lastProgramAttempt).TotalSeconds<30){snapshot.readErrors["fullProgram"]=(lastProgramFailure??"Complete program not obtained")+"; retry scheduled within 30 seconds";return;}
        lastProgramAttemptKey=key;lastProgramAttempt=DateTime.UtcNow;lastProgramFailure=null;
        bool started=false,ended=false;FullProgram result=null;
        try{
            short code=cnc_upstart3(handle,0,number,number);if(code!=0){snapshot.readErrors["fullProgram"]="cnc_upstart3 (CNC to PC read): FOCAS "+code;return;}started=true;
            System.Diagnostics.Stopwatch timer=System.Diagnostics.Stopwatch.StartNew();StringBuilder text=new StringBuilder();byte[] buffer=new byte[8192];int bytesRead=0,bufferWaits=0;
            for(int calls=0;calls<4096&&timer.ElapsedMilliseconds<8000&&text.Length<2*1024*1024;calls++){
                int length=buffer.Length;code=cnc_upload3(handle,ref length,buffer);
                if(code==10){bufferWaits++;System.Threading.Thread.Sleep(10);continue;}
                if(code!=0||length<=0||length>buffer.Length){snapshot.readErrors["fullProgram"]="cnc_upload3: "+(code==0?"Invalid/empty chunk":"FOCAS "+code);break;}
                bytesRead+=length;if(bytesRead>2*1024*1024){snapshot.readErrors["fullProgram"]="Full program exceeds 2 MiB read limit";break;}
                text.Append(Encoding.Default.GetString(buffer,0,length).TrimEnd('\0'));
                int last=text.Length-1;while(last>=0&&Char.IsWhiteSpace(text[last]))last--;
                if(last>=0&&text[last]=='%'&&IsCompleteProgram(text.ToString(),number)){
                    string content=text.ToString();byte[] hash;using(System.Security.Cryptography.SHA256 sha=System.Security.Cryptography.SHA256.Create()){hash=sha.ComputeHash(Encoding.UTF8.GetBytes(content));}
                    result=new FullProgram{program=snapshot.activeProgram,text=content,sha256=BitConverter.ToString(hash).Replace("-","").ToLowerInvariant(),complete=true,sampledAtUtc=DateTime.UtcNow.ToString("o")};break;
                }
            }
            if(result==null&&!snapshot.readErrors.ContainsKey("fullProgram"))snapshot.readErrors["fullProgram"]="Complete program not obtained within 8 seconds / 2 MiB (elapsed="+timer.ElapsedMilliseconds+" ms, bytes="+bytesRead+", buffer waits="+bufferWaits+"); partial text not presented as full file";
        }catch(EntryPointNotFoundException){snapshot.readErrors["fullProgram"]="Optional read-only upload API unavailable";}
        finally{
            if(started){try{short endCode=cnc_upend3(handle);ended=endCode==0;if(!ended){string primary;snapshot.readErrors.TryGetValue("fullProgram",out primary);snapshot.readErrors["fullProgram"]=(primary==null?String.Empty:primary+"; ")+"cnc_upend3: FOCAS "+endCode;}}catch(EntryPointNotFoundException){snapshot.readErrors["fullProgram"]="cnc_upend3 unavailable";}}
            snapshot.readErrors.TryGetValue("fullProgram",out lastProgramFailure);
        }
        if(result!=null&&ended){snapshot.fullProgram=result;programCache=result;programCacheKey=key;}
    }
    [DllImport("Fwlib64.dll",CallingConvention=CallingConvention.Winapi,ExactSpelling=true)]
    private static extern short cnc_rdhdnxt(ushort handle,out int head,out int next);
    [DllImport("Fwlib64.dll",CallingConvention=CallingConvention.Winapi,ExactSpelling=true)]
    private static extern short cnc_rdgcode(ushort handle,short type,short block,ref short count,IntPtr data);
    [DllImport("Fwlib64.dll",CallingConvention=CallingConvention.Winapi,ExactSpelling=true)]
    private static extern short cnc_rdtofsr(ushort handle,short start,short type,short end,short length,IntPtr data);
    [StructLayout(LayoutKind.Sequential,Pack=4)]
    public struct GcodeReading {public short group,flag;[MarshalAs(UnmanagedType.ByValArray,SizeConst=8)] public byte[] code;}
    public sealed class Gcode {public int group,flag;public string code;}
    public sealed class WorkCoordinate {public string name,unit;public double? x,y,z;public int? decimalsX,decimalsY,decimalsZ;}
    public sealed class OffsetRow {public int number;public double? value,geometry,wear,lengthGeometry,lengthWear,radiusGeometry,radiusWear;}
    public sealed class OffsetTable {public string memory,unit,sampledAtUtc;public int count,decimals;public OffsetRow[] rows;}
    private sealed class CachedOffsets {public OffsetTable table;public string key;public DateTime at;}
    private static CachedOffsets offsetCache;
    public static Gcode DecodeGcode(GcodeReading value)
    {
        if(value.code==null||value.code.Length!=8||value.group<0)return null;
        string code=Encoding.ASCII.GetString(value.code).TrimEnd('\0',' ');
        if(!System.Text.RegularExpressions.Regex.IsMatch(code,@"^G[0-9]{1,3}(\.[0-9]{1,3})?$"))return null;
        return new Gcode{group=value.group,flag=value.flag,code=code};
    }
    private static void ReadGcodes(ushort handle,Snapshot snapshot)
    {
        IntPtr buffer=Marshal.AllocHGlobal(256*12);
        try {
            Marshal.Copy(new byte[256*12],0,buffer,256*12);short count=64;short code=cnc_rdgcode(handle,-1,1,ref count,buffer);
            if(code!=0||count<1||count>64){snapshot.readErrors["gcodes"]="cnc_rdgcode: "+(code==0?"Invalid count":"FOCAS "+code);return;}
            List<Gcode> items=new List<Gcode>();for(int i=0;i<count;i++){Gcode item=DecodeGcode((GcodeReading)Marshal.PtrToStructure(IntPtr.Add(buffer,i*12),typeof(GcodeReading)));if(item!=null)items.Add(item);}
            snapshot.modalGcodes=items.ToArray();snapshot.modalGcodesComplete=count<64;
        }catch(EntryPointNotFoundException){snapshot.readErrors["gcodes"]="cnc_rdgcode unavailable";}finally{Marshal.FreeHGlobal(buffer);}
    }
    [DllImport("Fwlib64.dll",CallingConvention=CallingConvention.Winapi,ExactSpelling=true)]
    private static extern short cnc_rdzofs(ushort handle,short number,short axis,short length,out OffsetReading data);
    private static double? ReadWorkValue(ushort handle,short number,short axis,int decimals,Snapshot snapshot)
    {
        OffsetReading data;short code=cnc_rdzofs(handle,number,axis,8,out data);
        if(code!=0){snapshot.readErrors["workCoordinates"]="cnc_rdzofs: FOCAS "+code+" (offset="+number+", axis="+axis+")";return null;}
        if(data.number!=number||data.type!=axis){snapshot.readErrors["workCoordinates"]="cnc_rdzofs returned mismatched offset/axis data";return null;}
        return data.value!=Int32.MinValue?(double?)(data.value/Math.Pow(10,decimals)):null;
    }
    private static void ReadWorkCoordinates(ushort handle,Snapshot snapshot)
    {
        // Dedicated single-axis API avoids MAX_AXIS-dependent all-axis buffer lengths and does not move a program pointer.
        if(!IsThreeAxisMill(snapshot)){snapshot.readErrors["workCoordinates"]="Standard XYZ work table not validated for this machine ("+ProfileIdentity(snapshot)+")";return;}
        try {
            short count=3;byte[] names=new byte[192];if(cnc_rdaxisname(handle,ref count,names)!=0||count!=3||names[0]!='X'||names[2]!='Y'||names[4]!='Z'){snapshot.readErrors["workCoordinates"]="CNC axis names do not validate XYZ table";return;}
            string unit=PositionUnit(snapshot)??(snapshot.machiningContext==null?null:snapshot.machiningContext.unit);
            if(unit==null){int? units=IntegerCode(ReadMacro(handle,4006));unit=units==20?"inch":units==21?"mm":null;}
            if(unit==null){snapshot.readErrors["workCoordinates"]="Cannot validate coordinate unit";return;}
            // Stored work-zero values use input-unit figures. Output figures may legitimately differ.
            short figures;short[] input=new short[96],output=new short[96];short code=cnc_getfigure(handle,0,out figures,input,output);
            if(code!=0||figures<=0){snapshot.readErrors["workCoordinates"]="cnc_getfigure(axis precision): FOCAS "+code;return;}
            for(int i=0;i<3;i++)if(input[i]<0||input[i]>9){snapshot.readErrors["workCoordinates"]="Invalid XYZ input precision: axis="+(i+1)+", input="+input[i]+", output="+output[i];return;}
            List<WorkCoordinate> rows=new List<WorkCoordinate>();
            for(short number=0;number<7;number++)rows.Add(new WorkCoordinate{name=number==0?"EXT":"G"+(53+number),unit=unit,x=ReadWorkValue(handle,number,1,input[0],snapshot),y=ReadWorkValue(handle,number,2,input[1],snapshot),z=ReadWorkValue(handle,number,3,input[2],snapshot),decimalsX=input[0],decimalsY=input[1],decimalsZ=input[2]});
            snapshot.workCoordinates=rows.ToArray();
            if(snapshot.machiningContext!=null)foreach(WorkCoordinate row in rows)if(row.name==snapshot.machiningContext.workCoordinate){snapshot.machiningContext.workX=row.x;snapshot.machiningContext.workY=row.y;snapshot.machiningContext.workZ=row.z;}
        }catch(EntryPointNotFoundException){snapshot.readErrors["workCoordinates"]="Dedicated work-coordinate API unavailable";}
    }
    public static OffsetRow[] DecodeOffsetColumns(int count,int memory,int decimals,int[][] columns)
    {
        int fields=memory==0?1:memory==1?2:memory==2?4:0;
        if(count<1||count>2000||fields==0||decimals<0||decimals>9||columns==null||columns.Length!=fields)return null;
        foreach(int[] column in columns)if(column==null||column.Length!=count)return null;
        OffsetRow[] rows=new OffsetRow[count];double scale=Math.Pow(10,decimals);
        for(int i=0;i<count;i++){
            double?[] v=new double?[fields];for(int j=0;j<fields;j++)v[j]=columns[j][i]==Int32.MinValue?null:(double?)(columns[j][i]/scale);
            OffsetRow row=new OffsetRow{number=i+1};if(memory==0)row.value=v[0];else if(memory==1){row.geometry=v[0];row.wear=v[1];}else{row.lengthGeometry=v[0];row.lengthWear=v[1];row.radiusGeometry=v[2];row.radiusWear=v[3];}rows[i]=row;
        }return rows;
    }
    private static OffsetTable ReadOffsetTable(ushort handle,OffsetInfo info,int decimals,string unit)
    {
        if(info.count<1||info.count>2000)return null;
        string key=currentReadKey+"/"+info.memoryType+"/"+info.count+"/"+decimals+"/"+unit;
        if(offsetCache!=null&&offsetCache.key==key&&(DateTime.UtcNow-offsetCache.at).TotalSeconds<30)return offsetCache.table;
        int fields=info.memoryType==0?1:info.memoryType==1?2:4;int[][] columns=new int[fields][];
        int length=8+4*info.count;IntPtr buffer=Marshal.AllocHGlobal(length);
        try{
            for(short type=0;type<fields;type++){
                Marshal.Copy(new byte[length],0,buffer,length);
                short code=cnc_rdtofsr(handle,1,type,info.count,(short)length,buffer);
                if(code!=0||Marshal.ReadInt16(buffer,0)!=1||Marshal.ReadInt16(buffer,2)!=type||Marshal.ReadInt16(buffer,4)!=info.count)return null;
                columns[type]=new int[info.count];Marshal.Copy(IntPtr.Add(buffer,8),columns[type],0,info.count);
            }
        }catch(EntryPointNotFoundException){return null;}finally{Marshal.FreeHGlobal(buffer);}
        OffsetRow[] rows=DecodeOffsetColumns(info.count,info.memoryType,decimals,columns);if(rows==null)return null;
        OffsetTable table=new OffsetTable{memory=((char)('A'+info.memoryType)).ToString(),unit=unit,count=info.count,decimals=decimals,rows=rows,sampledAtUtc=DateTime.UtcNow.ToString("o")};
        offsetCache=new CachedOffsets{key=key,table=table,at=DateTime.UtcNow};return table;
    }
    private static string currentReadKey;
    [StructLayout(LayoutKind.Sequential,Pack=4)]
    public struct PositionElement {public int data;public short dec,unit,disp;public byte name,suff;}
    [StructLayout(LayoutKind.Sequential,Pack=4)]
    public struct PositionReading {public PositionElement absolute,machine,relative,distance;}
    [StructLayout(LayoutKind.Sequential,Pack=4)]
    public struct LoadElement {public int data;public short dec,unit;public byte name,suff1,suff2,reserve;}
    [StructLayout(LayoutKind.Sequential,Pack=4)]
    public struct SequenceReading {public short dummy1,dummy2;public int data;}
    public sealed class PositionValue {public double? value;public string unit;public int decimals,displayFlag;}
    public sealed class AxisPosition {public string axis;public PositionValue absolute,machine,relative,distance;}
    public sealed class ServoMeter {public string axis;public double? percent;public int decimals;}
    [DllImport("Fwlib64.dll",CallingConvention=CallingConvention.Winapi,ExactSpelling=true)]
    private static extern short cnc_rdposition(ushort handle,short type,ref short count,IntPtr data);
    [DllImport("Fwlib64.dll",CallingConvention=CallingConvention.Winapi,ExactSpelling=true)]
    private static extern short cnc_rdsvmeter(ushort handle,ref short count,IntPtr data);
    [DllImport("Fwlib64.dll",CallingConvention=CallingConvention.Winapi,ExactSpelling=true)]
    private static extern short cnc_rdseqnum(ushort handle,out SequenceReading data);
    [DllImport("Fwlib64.dll",CallingConvention=CallingConvention.Winapi,ExactSpelling=true)]
    private static extern short cnc_rdexecprog(ushort handle,ref ushort length,out short block,[Out] byte[] data);
    public static string AxisLabel(byte name,byte suffix)
    {
        if(name<(byte)'A'||name>(byte)'Z')return null;
        if(suffix==0||suffix==(byte)' ')return ((char)name).ToString();
        if((suffix>=(byte)'0'&&suffix<=(byte)'9')||(suffix>=(byte)'A'&&suffix<=(byte)'Z'))return ((char)name).ToString()+((char)suffix).ToString();
        return null;
    }
    public static PositionValue DecodePosition(PositionElement e)
    {
        string unit=e.unit==0?"mm":e.unit==1?"inch":e.unit==2?"deg":null;
        if(unit==null||e.dec<0||e.dec>9||e.data==Int32.MinValue||AxisLabel(e.name,e.suff)==null)return null;
        return new PositionValue{value=e.data/Math.Pow(10,e.dec),unit=unit,decimals=e.dec,displayFlag=e.disp};
    }
    public static ServoMeter DecodeServo(LoadElement e)
    {
        string axis=AxisLabel(e.name,e.suff1);
        if(axis==null||e.unit!=0||e.dec<0||e.dec>9||e.data<0)return null;
        return new ServoMeter{axis=axis,percent=e.data/Math.Pow(10,e.dec),decimals=e.dec};
    }
    private static void ReadOperatorTelemetry(ushort handle,Snapshot snapshot)
    {
        int axes;
        if(!Int32.TryParse(snapshot.axes,out axes)||axes<1||axes>96){snapshot.readErrors["positions"]="Cannot validate CNC axis count";return;}
        if(Marshal.SizeOf(typeof(PositionElement))!=12||Marshal.SizeOf(typeof(PositionReading))!=48||Marshal.SizeOf(typeof(LoadElement))!=12||Marshal.SizeOf(typeof(SequenceReading))!=8)throw new InvalidOperationException("Operator telemetry layout mismatch");
        try {
            int size=Marshal.SizeOf(typeof(PositionReading));IntPtr buffer=Marshal.AllocHGlobal(96*size);
            try {
                short count=(short)axes;short code=cnc_rdposition(handle,-1,ref count,buffer);
                if(code==0&&count>0&&count<=axes){
                    List<AxisPosition> positions=new List<AxisPosition>();
                    for(int i=0;i<count;i++){
                        PositionReading v=(PositionReading)Marshal.PtrToStructure(IntPtr.Add(buffer,i*size),typeof(PositionReading));
                        string name=AxisLabel(v.absolute.name,v.absolute.suff)??AxisLabel(v.machine.name,v.machine.suff)??AxisLabel(v.relative.name,v.relative.suff);
                        if(name==null)continue;
                        positions.Add(new AxisPosition{axis=name,absolute=DecodePosition(v.absolute),machine=DecodePosition(v.machine),relative=DecodePosition(v.relative),distance=DecodePosition(v.distance)});
                    }
                    snapshot.positions=positions.ToArray();
                } else snapshot.readErrors["positions"]="cnc_rdposition: "+(code==0?"Invalid axis count":"FOCAS "+code);
            } finally{Marshal.FreeHGlobal(buffer);}
        } catch(EntryPointNotFoundException){snapshot.readErrors["positions"]="cnc_rdposition unavailable";}
        try {
            int size=Marshal.SizeOf(typeof(LoadElement));IntPtr buffer=Marshal.AllocHGlobal(96*size);
            try {
                short count=(short)axes;short code=cnc_rdsvmeter(handle,ref count,buffer);
                if(code==0&&count>0&&count<=axes){List<ServoMeter> loads=new List<ServoMeter>();for(int i=0;i<count;i++){ServoMeter value=DecodeServo((LoadElement)Marshal.PtrToStructure(IntPtr.Add(buffer,i*size),typeof(LoadElement)));if(value!=null)loads.Add(value);}snapshot.servoLoads=loads.ToArray();}
                else snapshot.readErrors["servoLoads"]="cnc_rdsvmeter: "+(code==0?"Invalid axis count":"FOCAS "+code);
            }finally{Marshal.FreeHGlobal(buffer);}
        }catch(EntryPointNotFoundException){snapshot.readErrors["servoLoads"]="cnc_rdsvmeter unavailable";}
        try {SequenceReading sequence;short code=cnc_rdseqnum(handle,out sequence);if(code==0&&sequence.data>=0)snapshot.sequenceNumber=sequence.data;else snapshot.readErrors["sequence"]="cnc_rdseqnum: FOCAS "+code;}catch(EntryPointNotFoundException){snapshot.readErrors["sequence"]="cnc_rdseqnum unavailable";}
        try {
            byte[] text=new byte[2048];ushort length=(ushort)text.Length;short block;short code=cnc_rdexecprog(handle,ref length,out block,text);
            if(code==0&&length<=text.Length){snapshot.programText=Encoding.Default.GetString(text,0,length).TrimEnd('\0');snapshot.programBufferBlock=block;snapshot.programTextLimited=length==text.Length;}
            else snapshot.readErrors["programText"]="cnc_rdexecprog: "+(code==0?"Invalid length":"FOCAS "+code);
        }catch(EntryPointNotFoundException){snapshot.readErrors["programText"]="cnc_rdexecprog unavailable";}
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
        public MachiningContext machiningContext;
        public AxisPosition[] positions;
        public FullProgram fullProgram;
        public Gcode[] modalGcodes;public bool modalGcodesComplete;public WorkCoordinate[] workCoordinates;public OffsetTable toolOffsets;
        public ServoMeter[] servoLoads;
        public int? sequenceNumber,programBufferBlock;
        public string programText;
        public bool programTextLimited;
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

    private static string Text(byte[] value) { return NormalizeCncText(value); }
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
    { return ReadInternal(ip,port,libraryDirectory,false,false); }
    public static Snapshot ReadWithContext(string ip, ushort port, string libraryDirectory)
    { return ReadInternal(ip,port,libraryDirectory,true,false); }
    public static Snapshot ReadWithContext(string ip, ushort port, string libraryDirectory,bool verifiedProfile)
    { return ReadInternal(ip,port,libraryDirectory,true,verifiedProfile); }
    public static Snapshot ReadWithContext(string ip, ushort port, string libraryDirectory,bool verifiedProfile,string offsetTable)
    { int table=offsetTable=="m-a"?0:offsetTable=="m-b"?1:offsetTable=="m-c"?2:-1;return ReadInternal(ip,port,libraryDirectory,true,verifiedProfile&&table>=0,table); }
    private static Snapshot ReadInternal(string ip, ushort port, string libraryDirectory,bool context,bool verifiedProfile,int expectedTable=2)
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
            currentReadKey=ip+":"+port;
            ReadOptionalTelemetry(handle, snapshot);
            if(context){ReadOperatorTelemetry(handle,snapshot);ReadGcodes(handle,snapshot);ReadMachiningContext(handle,snapshot,verifiedProfile,expectedTable);ReadWorkCoordinates(handle,snapshot);}
            ReadAlarms(handle, snapshot);
            if(context)ReadFullProgram(handle,snapshot);
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
