using System;
using System.Text;
using System.Threading;
using System.Security.Cryptography;
public sealed class OfflineRequest {
 public string Method,Target,Body,Cookie,Csrf;
 public int Status=500;public string Type="application/json; charset=utf-8",SetCookie;
 public byte[] Result=Encoding.UTF8.GetBytes("{\"error\":\"Request not processed\"}");
 public readonly ManualResetEventSlim Done=new ManualResetEventSlim(false);
 public void Respond(int status,string json,string cookie){Status=status;Result=Encoding.UTF8.GetBytes(json);SetCookie=cookie;Done.Set();}
}
public static class OfflineCrypto {
 public static string Token(){byte[] value=new byte[32];using(RandomNumberGenerator rng=RandomNumberGenerator.Create())rng.GetBytes(value);return Convert.ToBase64String(value).TrimEnd('=').Replace('+','-').Replace('/','_');}
 public static string Hash(string password){byte[] salt=new byte[16];using(RandomNumberGenerator rng=RandomNumberGenerator.Create())rng.GetBytes(salt);using(Rfc2898DeriveBytes k=new Rfc2898DeriveBytes(password,salt,150000,HashAlgorithmName.SHA256))return Convert.ToBase64String(salt)+":"+Convert.ToBase64String(k.GetBytes(32));}
 public static bool Equal(string a,string b){if(a==null||b==null||a.Length!=b.Length)return false;int diff=0;for(int i=0;i<a.Length;i++)diff|=a[i]^b[i];return diff==0;}
 public static bool Verify(string password,string stored){try{string[] parts=stored.Split(':');using(Rfc2898DeriveBytes k=new Rfc2898DeriveBytes(password,Convert.FromBase64String(parts[0]),150000,HashAlgorithmName.SHA256))return Equal(Convert.ToBase64String(k.GetBytes(32)),parts[1]);}catch{return false;}}
}
