using System;
using System.IO;
using System.Net;
using System.ComponentModel;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Threading.Tasks;

// Separate local diagnostic utility. Native allowlist contains connection/read/release only.
// DGN metadata layout: FANUC 30i / 0i-D/F / PMi-A, Fwlib64.h ODBDIAGIF/ODBDGN.
public static class LtdDiagnosticReader {
 public static string Build { get { return "20261109-diagnostics-readonly"; } }
 [StructLayout(LayoutKind.Sequential,Pack=4)] public struct Status { public short hdck,tmmode,aut,run,motion,mstb,emergency,alarm,edit; }
 [StructLayout(LayoutKind.Sequential,Pack=4)] public struct Info {
  public short addinfo,max_axis;
  [MarshalAs(UnmanagedType.ByValArray,SizeConst=2)] public byte[] cnc_type;
  [MarshalAs(UnmanagedType.ByValArray,SizeConst=2)] public byte[] mt_type;
  [MarshalAs(UnmanagedType.ByValArray,SizeConst=4)] public byte[] series;
  [MarshalAs(UnmanagedType.ByValArray,SizeConst=4)] public byte[] version;
  [MarshalAs(UnmanagedType.ByValArray,SizeConst=2)] public byte[] axes;
 }
 public sealed class Snapshot {
  public string timeUtc,controller,dgnValue,dgnType,dgnError,pmcAddress,pmcError,connectionError;
  public Status status; public bool statusKnown; public byte? pmcValue; public int? dgnNumber,dgnAxis;
 }
 public sealed class Diagnosis { public string value,type; }
 [DllImport("kernel32.dll",EntryPoint="LoadLibraryExW",CharSet=CharSet.Unicode,SetLastError=true)] private static extern IntPtr LoadLibraryEx(string path,IntPtr reserved,uint flags);
 [DllImport("Fwlib64.dll",CallingConvention=CallingConvention.Winapi,CharSet=CharSet.Ansi,ExactSpelling=true)] private static extern short cnc_allclibhndl3(string ip,ushort port,int timeout,out ushort handle);
 [DllImport("Fwlib64.dll",CallingConvention=CallingConvention.Winapi,ExactSpelling=true)] private static extern short cnc_sysinfo(ushort handle,out Info info);
 [DllImport("Fwlib64.dll",CallingConvention=CallingConvention.Winapi,ExactSpelling=true)] private static extern short cnc_statinfo(ushort handle,out Status status);
 [DllImport("Fwlib64.dll",CallingConvention=CallingConvention.Winapi,ExactSpelling=true)] private static extern short cnc_rddiaginfo(ushort handle,short start,ushort count,IntPtr data);
 [DllImport("Fwlib64.dll",CallingConvention=CallingConvention.Winapi,ExactSpelling=true)] private static extern short cnc_diagnoss(ushort handle,short number,short axis,short length,IntPtr data);
 [DllImport("Fwlib64.dll",CallingConvention=CallingConvention.Winapi,ExactSpelling=true)] private static extern short pmc_rdpmcrng(ushort handle,short area,short type,ushort start,ushort end,ushort length,IntPtr data);
 [DllImport("Fwlib64.dll",CallingConvention=CallingConvention.Winapi,ExactSpelling=true)] private static extern short cnc_freelibhndl(ushort handle);
 private static readonly object Gate=new object(); private static string loaded;
 public static void Load(string directory) {
  if(IntPtr.Size!=8 || Environment.OSVersion.Platform!=PlatformID.Win32NT)throw new InvalidOperationException("Use 64-bit Windows PowerShell on Windows.");
  directory=Path.GetFullPath(directory);
  lock(Gate){
   if(loaded!=null){if(!String.Equals(loaded,directory,StringComparison.OrdinalIgnoreCase))throw new InvalidOperationException("Restart before choosing different DLLs.");return;}
   foreach(string name in new string[]{"fwlibe64.dll","fwlib30i64.dll","Fwlib64.dll"}){
    string path=Path.Combine(directory,name);if(!File.Exists(path))throw new FileNotFoundException("Missing "+name);
    if(LoadLibraryEx(path,IntPtr.Zero,0x100|0x1000)==IntPtr.Zero)throw new Win32Exception(Marshal.GetLastWin32Error(),"Cannot load "+name);
   }loaded=directory;
  }
 }
 private static void Check(string name,short code){if(code!=0)throw new InvalidOperationException(name+": FOCAS "+code.ToString(CultureInfo.InvariantCulture));}
 public static short PmcArea(string area){switch(area){case "G":return 0;case "F":return 1;case "Y":return 2;case "X":return 3;case "R":return 5;default:throw new ArgumentException("Allowed PMC areas: X, Y, R, G, F.");}}
 public static byte DecodePmc(byte[] data,short area,ushort address){
  if(data==null||data.Length<9||BitConverter.ToInt16(data,0)!=area||BitConverter.ToInt16(data,2)!=0||BitConverter.ToUInt16(data,4)!=address||BitConverter.ToUInt16(data,6)!=address)throw new InvalidOperationException("PMC reply header mismatch.");
  return data[8];
 }
 public static int DataSize(ushort attribute){
  if((attribute&0x100)!=0)throw new InvalidOperationException("Spindle DGN is not supported in this XYZ/single-axis test.");
  if((attribute&8)!=0)return 1;
  int kind=attribute&3;return kind<2?1:kind==2?2:(attribute&0x1000)!=0?8:4;
 }
 public static Diagnosis DecodeDgn(byte[] data,short number,short axis,ushort attribute){
  int size=DataSize(attribute);
  if(data==null||data.Length<4+size||BitConverter.ToInt16(data,0)!=number||BitConverter.ToInt16(data,2)!=axis)throw new InvalidOperationException("DGN reply header mismatch.");
  bool withAxis=(attribute&4)!=0;
  if(withAxis?axis<1:axis!=0)throw new ArgumentException("DGN axis does not match metadata.");
  bool bit=(attribute&8)!=0||(attribute&3)==0,signed=(attribute&128)!=0;
  string text,type;
  if(bit){text="0x"+data[4].ToString("X2")+" / "+Convert.ToString(data[4],2).PadLeft(8,'0');type="BIT (7..0)";}
  else if(size==8){int decimals=BitConverter.ToInt32(data,8);if(decimals<0||decimals>9)throw new InvalidOperationException("Unsupported DGN decimal precision.");text=((decimal)BitConverter.ToInt32(data,4)/(decimal)Math.Pow(10,decimals)).ToString("F"+decimals,CultureInfo.InvariantCulture);type="REAL";}
  else {long value=size==1?(signed?(long)(sbyte)data[4]:data[4]):size==2?(signed?(long)BitConverter.ToInt16(data,4):BitConverter.ToUInt16(data,4)):(signed?(long)BitConverter.ToInt32(data,4):BitConverter.ToUInt32(data,4));text=value.ToString(CultureInfo.InvariantCulture);type=(signed?"INT":"UINT")+(size*8);}
  return new Diagnosis{value=text,type=type};
 }
 private static IntPtr Buffer(int size){IntPtr p=Marshal.AllocHGlobal(size);Marshal.Copy(new byte[size],0,p,size);return p;}
 public static bool ModernDgnProfile(string cncType,short addinfo){
  string type=(cncType??"").Trim();int model=((ushort)addinfo)>>8;
  return type=="30"||type=="31"||type=="32"||type=="35"||(type=="0"&&(model==4||model==6))||(type=="PM"&&model==1);
 }
 private static Diagnosis ReadDgn(ushort handle,short number,short axis,int maximumAxes){
  // Read a single exact metadata entry; never scan for a guessed diagnosis number.
  ushort attribute;IntPtr meta=Buffer(64);
  try{Check("cnc_rddiaginfo",cnc_rddiaginfo(handle,number,1,meta));if(Marshal.ReadInt16(meta,0)!=1||Marshal.ReadInt16(meta,6)!=number)throw new InvalidOperationException("DGN number not available; no adjacent number substituted.");attribute=unchecked((ushort)Marshal.ReadInt16(meta,8));}finally{Marshal.FreeHGlobal(meta);}
  bool withAxis=(attribute&4)!=0;if(withAxis?(axis<1||axis>maximumAxes):axis!=0)throw new ArgumentException("Select axis 0 for non-axis DGN, or a valid axis number for axis DGN.");
  int size=DataSize(attribute);IntPtr p=Buffer(64);
  try{Check("cnc_diagnoss",cnc_diagnoss(handle,number,axis,(short)(4+size),p));byte[] data=new byte[4+size];Marshal.Copy(p,data,0,data.Length);return DecodeDgn(data,number,axis,attribute);}finally{Marshal.FreeHGlobal(p);}
 }
 private static byte ReadPmc(ushort handle,string area,ushort address){
  short code=PmcArea(area);IntPtr p=Buffer(32);
  try{Check("pmc_rdpmcrng",pmc_rdpmcrng(handle,code,0,address,address,9,p));byte[] data=new byte[9];Marshal.Copy(p,data,0,9);return DecodePmc(data,code,address);}finally{Marshal.FreeHGlobal(p);}
 }
 public static Snapshot Read(string ip,ushort port,int dgn,int axis,string area,int address){
  IPAddress parsed;if(!IPAddress.TryParse(ip,out parsed)||parsed.AddressFamily!=System.Net.Sockets.AddressFamily.InterNetwork||port==0)throw new ArgumentException("Invalid CNC IPv4 / port.");
  if(dgn < -1||dgn>32767||axis<0||axis>32||address < -1||address>65535)throw new ArgumentException("Invalid DGN/axis/PMC address.");
  if(address>=0)PmcArea(area);
  Snapshot result=new Snapshot();ushort handle=0;bool opened=false;
  try{
   Check("cnc_allclibhndl3",cnc_allclibhndl3(ip,port,3,out handle));opened=true;
   Info info;Check("cnc_sysinfo",cnc_sysinfo(handle,out info));result.controller=Text(info.cnc_type)+" / "+Text(info.mt_type)+" / "+Text(info.series)+" / "+Text(info.version);
   try{Status status;Check("cnc_statinfo",cnc_statinfo(handle,out status));result.status=status;result.statusKnown=true;}catch(Exception e){result.connectionError=e.Message;}
   if(dgn>=0){result.dgnNumber=dgn;result.dgnAxis=axis;try{if(!ModernDgnProfile(Text(info.cnc_type),info.addinfo))throw new InvalidOperationException("DGN metadata profile not validated for this controller/model; no value guessed.");Diagnosis value=ReadDgn(handle,(short)dgn,(short)axis,info.max_axis);result.dgnValue=value.value;result.dgnType=value.type;}catch(Exception e){result.dgnError=e.Message;}}
   if(address>=0){result.pmcAddress=area+address.ToString(CultureInfo.InvariantCulture);try{result.pmcValue=ReadPmc(handle,area,(ushort)address);}catch(Exception e){result.pmcError=e.Message;}}
  }catch(Exception e){result.connectionError=e.Message;}
  finally{if(opened){short code=cnc_freelibhndl(handle);if(code!=0)result.connectionError=(result.connectionError??"")+"; cnc_freelibhndl: FOCAS "+code;}result.timeUtc=DateTime.UtcNow.ToString("o");}
  return result;
 }
 private static string Text(byte[] bytes){return System.Text.Encoding.ASCII.GetString(bytes).Trim(' ','\0');}
 public static Task<Snapshot> ReadAsync(string ip,ushort port,int dgn,int axis,string area,int address){return Task.Run(()=>Read(ip,port,dgn,axis,area,address));}
}
