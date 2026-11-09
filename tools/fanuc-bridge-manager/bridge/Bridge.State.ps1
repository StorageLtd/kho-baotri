# Auxiliary status I/O only; failures must never stop CNC collection.
if(-not ('LtdBridgeStateIoV1' -as [type])){
 Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Text;
public static class LtdBridgeStateIoV1 {
 public static bool TryWrite(string path,string json){
  string temporary=path+"."+Guid.NewGuid().ToString("N")+".tmp";
  try{
   File.WriteAllText(temporary,json,new UTF8Encoding(false));
   for(int attempt=0;attempt<4;attempt++){
    try{if(File.Exists(path))File.Replace(temporary,path,null);else File.Move(temporary,path);return true;}
    catch(IOException){if(attempt<3)System.Threading.Thread.Sleep(15);}
    catch(UnauthorizedAccessException){return false;}
   }
  }catch(IOException){}catch(UnauthorizedAccessException){}
  finally{try{if(File.Exists(temporary))File.Delete(temporary);}catch{}}
  return false;
 }
 public static string TryRead(string path){
  try{using(FileStream stream=new FileStream(path,FileMode.Open,FileAccess.Read,FileShare.ReadWrite|FileShare.Delete)){
   if(stream.Length>65536)return null;
   using(StreamReader reader=new StreamReader(stream,Encoding.UTF8,true))return reader.ReadToEnd();
  }}catch(IOException){return null;}catch(UnauthorizedAccessException){return null;}
 }
}
'@
}
function Write-BridgeStateFile([string]$Path,$Value){
 try{return [LtdBridgeStateIoV1]::TryWrite($Path,($Value|ConvertTo-Json -Depth 6 -Compress))}catch{return $false}
}
function Read-BridgeStateFile([string]$Path){
 try{$json=[LtdBridgeStateIoV1]::TryRead($Path);if($json){return $json|ConvertFrom-Json -ErrorAction Stop}}catch{}
 return $null
}
