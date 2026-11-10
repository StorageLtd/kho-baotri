using System;
using System.IO;
using System.Text;
using System.Security.Cryptography;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;

// Per-laptop configuration only. No built-in/shared password or plaintext password file.
public sealed class TransferPasswordStore {
 [DataContract] private sealed class Record {
  [DataMember] public int version,iterations;
  [DataMember] public string salt,digest;
 }
 private const int Iterations=150000;
 private readonly string path;
 public static string DefaultPath {get{return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"LTD","CncBridgeManager","machines","transfer-auth.json");}}
 public TransferPasswordStore(string file){path=Path.GetFullPath(file);ReadRecord();}
 private Record ReadRecord(){
  if(!File.Exists(path))throw new InvalidOperationException("Chưa đặt mật khẩu truyền/nhận. Đặt mật khẩu một lần trong Bridge Manager trước.");
  FileInfo file=new FileInfo(path);if(file.Length<32||file.Length>4096)throw new InvalidOperationException("Cấu hình mật khẩu truyền không hợp lệ.");
  Record value;using(FileStream input=new FileStream(path,FileMode.Open,FileAccess.Read,FileShare.ReadWrite|FileShare.Delete)){value=(Record)new DataContractJsonSerializer(typeof(Record)).ReadObject(input);}
  if(value==null||value.version!=1||value.iterations<100000||value.iterations>500000||Convert.FromBase64String(value.salt).Length!=16||Convert.FromBase64String(value.digest).Length!=32)throw new InvalidOperationException("Cấu hình mật khẩu truyền không hợp lệ.");
  return value;
 }
 public string Revision {get{Record value=ReadRecord();return value.salt+":"+value.digest;}}
 public bool Verify(string password){
  if(password==null||password.Length<6||password.Length>128)return false;
  Record value=ReadRecord();byte[] expected=Convert.FromBase64String(value.digest),actual;
  using(Rfc2898DeriveBytes kdf=new Rfc2898DeriveBytes(password,Convert.FromBase64String(value.salt),value.iterations,HashAlgorithmName.SHA256)){actual=kdf.GetBytes(32);}
  int diff=0;for(int i=0;i<expected.Length;i++)diff|=expected[i]^actual[i];Array.Clear(actual,0,actual.Length);return diff==0;
 }
 public static void Save(string file,string password){
  if(String.IsNullOrEmpty(password)||password.Length<6||password.Length>128)throw new ArgumentException("Mật khẩu truyền phải từ 6 đến 128 ký tự.");
  byte[] salt=new byte[16],digest;using(RandomNumberGenerator rng=RandomNumberGenerator.Create()){rng.GetBytes(salt);}
  using(Rfc2898DeriveBytes kdf=new Rfc2898DeriveBytes(password,salt,Iterations,HashAlgorithmName.SHA256)){digest=kdf.GetBytes(32);}
  Record record=new Record{version=1,iterations=Iterations,salt=Convert.ToBase64String(salt),digest=Convert.ToBase64String(digest)};Array.Clear(digest,0,digest.Length);
  string path=Path.GetFullPath(file);Directory.CreateDirectory(Path.GetDirectoryName(path));string temporary=path+"."+Guid.NewGuid().ToString("N")+".tmp";
  try{using(FileStream output=new FileStream(temporary,FileMode.CreateNew,FileAccess.Write,FileShare.None)){new DataContractJsonSerializer(typeof(Record)).WriteObject(output,record);output.Flush();}if(File.Exists(path))File.Replace(temporary,path,null);else File.Move(temporary,path);}
  finally{if(File.Exists(temporary))File.Delete(temporary);}
 }
}
