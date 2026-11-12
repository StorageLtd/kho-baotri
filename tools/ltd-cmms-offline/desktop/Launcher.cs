using System;
using System.IO;
using System.Text;
using System.Diagnostics;
using System.Windows.Forms;
[assembly:System.Runtime.Versioning.TargetFramework(".NETFramework,Version=v4.8")]
internal static class LtdDesktopLauncher {
 [STAThread] private static int Main(){
  try{
   string folder=AppDomain.CurrentDomain.BaseDirectory;
   if(!File.Exists(Path.Combine(folder,"Desktop.Main.ps1")))throw new FileNotFoundException("Giai nen toan bo thu muc chuong trinh truoc khi chay.");
   string script="$root='"+folder.Replace("'","''")+"'; Get-ChildItem -LiteralPath $root -Recurse -File | Unblock-File; & (Join-Path $root 'Desktop.Main.ps1')";
   string command=Convert.ToBase64String(Encoding.Unicode.GetBytes(script));
   ProcessStartInfo start=new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),@"WindowsPowerShell\v1.0\powershell.exe"),"-STA -NoLogo -NoProfile -WindowStyle Hidden -ExecutionPolicy RemoteSigned -EncodedCommand "+command);
   start.WorkingDirectory=folder;start.UseShellExecute=false;start.CreateNoWindow=true;
   using(Process process=Process.Start(start)){process.WaitForExit();if(process.ExitCode!=0)MessageBox.Show("LTD CMMS chua khoi dong duoc. Chay START-CMMS-CONSOLE.cmd de xem loi. Khong xoa du lieu AppData.","LTD CMMS Desktop",MessageBoxButtons.OK,MessageBoxIcon.Information);return process.ExitCode;}
  }catch(Exception error){MessageBox.Show(error.Message,"LTD CMMS Desktop",MessageBoxButtons.OK,MessageBoxIcon.Error);return 1;}
 }
}
