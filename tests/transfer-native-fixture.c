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
int16_t cnc_rdprogdir3(uint16_t h,int16_t type,int32_t *top,int16_t *count,uint8_t *p){(void)h;if(type!=2)return -99;if(mode==9){*count=33;return 0;}if(*count==1){if(mode==1){entry(p,*top);}else{*count=0;}return 0;}entry(p,1234);entry(p+88,1235);*top=1234;*count=2;return 0;}
int16_t cnc_dwnstart3(uint16_t h,int16_t type){(void)h;if(type!=0)return -99;starts++;return 0;}
int16_t cnc_download3(uint16_t h,int32_t *length,const char *data){(void)h;download_calls++;if(*length>1280||*length<=0)return -99;if(download_calls==1){*length=0;return 10;}if(mode==8){*length=0;return 0;}int n=*length>7?7:*length;memcpy(sent+sentlen,data,n);sentlen+=n;*length=n;return 0;}
int16_t cnc_dwnend3(uint16_t h){(void)h;ends++;return mode==5?5:0;}
int16_t cnc_upstart3(uint16_t h,int16_t type,int32_t start,int32_t end){(void)h;if(type!=0||start!=end||start!=1234)return -99;upstarts++;return 0;}
int16_t cnc_upload3(uint16_t h,int32_t *length,char *data){(void)h;upcalls++;if(upcalls==1){*length=0;return 10;}const char *text=mode==6?"%\nO9999\nM30\n%":mode==7?"%\nO1234\nM30":"%\nO1234 (TEST)\nM99\n%\n";int len=(int)strlen(text);if(position==len)return -2;int n=len-position;if(n>8)n=8;if(n>*length)return -99;memcpy(data,text+position,n);position+=n;*length=n;return 0;}
int16_t cnc_upend3(uint16_t h){(void)h;upends++;return mode==4?7:0;}
