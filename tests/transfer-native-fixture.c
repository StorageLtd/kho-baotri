#include <stdint.h>
#include <string.h>
#include <unistd.h>
typedef struct {int16_t hdck,tmmode,aut,run,motion,mstb,emergency,alarm,edit;} Status;
static char last_ip[64];
const char *tx_last_ip(void){return last_ip;}
static int mode,opened,freed,starts,ends,download_calls,upstarts,upends,upcalls,position;static char sent[2097152];static int sentlen;
void tx_reset(int m){mode=m;opened=freed=starts=ends=download_calls=upstarts=upends=upcalls=position=sentlen=0;}
int tx_opened(void){return opened;}int tx_freed(void){return freed;}int tx_starts(void){return starts;}int tx_ends(void){return ends;}int tx_upends(void){return upends;}int tx_sentlen(void){return sentlen;}
int tx_matches(const char *text){return (int)strlen(text)==sentlen&&memcmp(text,sent,sentlen)==0;}
int16_t cnc_allclibhndl3(const char *ip,uint16_t port,int32_t timeout,uint16_t *h){strncpy(last_ip,ip,63);last_ip[63]=0;if(port!=8193||timeout!=10)return -99;*h=12;opened++;return 0;}
int16_t cnc_freelibhndl(uint16_t h){if(h!=12)return -99;freed++;return 0;}
int16_t cnc_getpath(uint16_t h,int16_t *path,int16_t *paths){(void)h;*path=1;*paths=mode==3?2:1;return 0;}
int16_t cnc_statinfo(uint16_t h,Status *s){(void)h;if(mode==11)usleep(300000);memset(s,0,sizeof(*s));s->aut=3;s->run=mode==2?3:0;return 0;}
static void entry(uint8_t *p,int32_t number){int32_t length=24;memset(p,0,88);memcpy(p,&number,4);memcpy(p+4,&length,4);memcpy(p+12,"(TEST)",6);int16_t date[]={2026,11,10,9,30,0};memcpy(p+64,date,12);}
int16_t cnc_rdprogdir3(uint16_t h,int16_t type,int32_t *top,int16_t *count,uint8_t *p){
 (void)h;
 if(mode==14&&type==2)return 4;
 if(type!=2&&type!=0)return -99;
 if(mode==9){*count=33;return 0;}
 if(mode==13&&*count>1)return 2;
 if(*count==1&&mode!=12&&mode!=13&&mode!=14&&mode!=15&&mode!=16){if(mode==1){entry(p,*top);}else{*count=0;}return 0;}
 int32_t requested=*top;int16_t capacity=*count;
 int32_t numbers[]={1234,1235,7020};int total=(mode>=12&&mode<=16)?3:2;
 if(mode==16){entry(p,1234);*top=1234;*count=1;return 0;}
 *count=0;
 for(int i=0;i<total;i++){
  if(numbers[i]<requested)continue;
  if(*count==0){*top=numbers[i];}
  entry(p+(*count)*88,numbers[i]);(*count)++;
  if(*count==capacity||mode==12||mode==13||mode==14||mode==15)break;
 }
 if(mode==15&&*count==0)return 3;
 return 0;
}
int16_t cnc_dwnstart3(uint16_t h,int16_t type){(void)h;if(type!=0)return -99;starts++;return 0;}
int16_t cnc_download3(uint16_t h,int32_t *length,const char *data){(void)h;download_calls++;if(*length>1280||*length<=0)return -99;if(download_calls==1){*length=0;return 10;}if(mode==8){*length=0;return 0;}int n=*length>7?7:*length;memcpy(sent+sentlen,data,n);sentlen+=n;*length=n;return 0;}
int16_t cnc_dwnend3(uint16_t h){(void)h;ends++;return mode==5?5:0;}
int16_t cnc_upstart3(uint16_t h,int16_t type,int32_t start,int32_t end){(void)h;if(type!=0||start!=end||start!=1234)return -99;upstarts++;return 0;}
int16_t cnc_upload3(uint16_t h,int32_t *length,char *data){(void)h;upcalls++;if(upcalls==1){*length=0;return 10;}const char *text=mode==6?"%\nO9999\nM30\n%":mode==7?"%\nO1234\nM30":"%\nO1234 (TEST)\nM99\n%\n";int len=(int)strlen(text);if(position==len)return -2;int n=len-position;if(n>8)n=8;if(n>*length)return -99;memcpy(data,text+position,n);position+=n;*length=n;return 0;}
int16_t cnc_upend3(uint16_t h){(void)h;upends++;return mode==4?7:0;}
static char last_program_path[244];
const char *tx_last_program_path(void){return last_program_path;}
static void pdfentry(uint8_t *p,int folder,const char *name){
 memset(p,0,128);int16_t kind=folder?0:1;memcpy(p,&kind,2);int16_t date[]={2026,11,10,10,30,0};memcpy(p+2,date,12);int32_t size=32;memcpy(p+20,&size,4);strncpy((char*)p+28,name,35);memcpy(p+64,"(MEMORY FILE)",13);
}
int16_t cnc_rdpdf_alldir(uint16_t h,int16_t *count,const uint8_t *input,uint8_t *out){
 (void)h;if(mode<17)return 6;if(mode==18)return 7;
 int16_t index,size_kind,type;memcpy(&index,input+212,2);memcpy(&size_kind,input+214,2);memcpy(&type,input+216,2);
 if(*count<1||size_kind!=1||type!=1)return -99;
 const char *path=(const char*)input;
 if(mode==22){const char *names[]={"O0012","O0301.NC","O0999.NC","O1111.NC","O2222.NC"};if(index>=5){*count=0;return 0;}pdfentry(out,0,names[index]);*count=1;return 0;}
 if(mode==19){pdfentry(out,0,"O1234");*count=1;return 0;}
 if(strcmp(path,"//CNC_MEM/USER/PATH1/")==0){
  if(mode==21){if(index==0){pdfentry(out,1,"..");*count=1;return 0;}index--;}
  if(index>=3){*count=0;return 0;}const char *names[]={"O1234","O2000","SUB"};pdfentry(out,index==2,names[index]);*count=1;return 0;
 }
 if(strcmp(path,"//CNC_MEM/USER/PATH1/SUB/")==0){
  if(index>=3){*count=0;return 0;}const char *names[]={"O1234","O3000","O4000"};pdfentry(out,0,names[index]);*count=1;return 0;
 }return 5;
}
int16_t cnc_rdpdf_curdir(uint16_t h,int16_t kind,char *path){(void)h;if(kind!=1)return -99;strcpy(path,mode==20?"//CNC_MEM/USER/PATH1/OTHER/":"//CNC_MEM/USER/PATH1/");return 0;}
int16_t cnc_upstart4(uint16_t h,int16_t type,const char *path){strncpy(last_program_path,path,243);return cnc_upstart3(h,type,1234,1234);}
int16_t cnc_upload4(uint16_t h,int32_t *length,char *data){return cnc_upload3(h,length,data);}
int16_t cnc_upend4(uint16_t h){return cnc_upend3(h);}
