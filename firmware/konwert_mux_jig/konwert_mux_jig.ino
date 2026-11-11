/*
  Konwert MUX Jig (ESP32)

  Data is sent to the Vercel app:
    https://jig.konwertindiamotors.com/api/send?sno=1&testby=2&appby=3
    https://jig.konwertindiamotors.com/api/send_ssr?sno=1&delay=2&voutm=3&vout_a=4&ssr_1=3&ssr_2=3&ssr_3=3&ssr_4=3

  Optional: if DEVICE_KEY is set on Vercel, put the same value in DEVICE_KEY below.
  API docs: https://jig.konwertindiamotors.com/docs
*/

volatile int interruptCounter;
int sec, ssec, ok, en;

hw_timer_t * timer = NULL;
portMUX_TYPE timerMux = portMUX_INITIALIZER_UNLOCKED;

void IRAM_ATTR onTimer()
{
  portENTER_CRITICAL_ISR(&timerMux);
  interruptCounter++;
  portEXIT_CRITICAL_ISR(&timerMux);
}


#include <WiFi.h>
#include <HTTPClient.h>
#include <SoftwareSerial.h>
#include <ArduinoJson.h>


#define R1 18
#define R2 19
#define R3 21
#define R4 22
#define R5 2
#define R6 4

#define SR_1 13
#define SR_2 14
#define SR_3 27
#define SR_4 26

#define BUZZER 23

#define RXD2 16 //(RX2)16
#define TXD2 17 //(TX2)17

#define VOUT_M 34
#define VOUT_A 35


#define hmi_Serial2 Serial2

// Wi-Fi name, password and device key live in secrets.h (not committed).
// Copy secrets.example.h to secrets.h and fill it in.
#include "secrets.h"

const char* ssid = WIFI_SSID;
const char* password = WIFI_PASSWORD;

char serInString[500];
int  serInIndx  = 0;
char sb;


// ---------------------------------------------------------------- API config
const char* URL  = "https://jig.konwertindiamotors.com/api/send?";
const char* URL1 = "https://jig.konwertindiamotors.com/api/send_ssr?";

// Set DEVICE_KEY_VALUE in secrets.h. Leave it empty if the key is not enabled on the server.
const char* DEVICE_KEY = DEVICE_KEY_VALUE;

String keyParam()
{
  if (strlen(DEVICE_KEY) == 0) return "";
  return String("&key=") + DEVICE_KEY;
}
// ----------------------------------------------------------------------------


int count_Val, page_num;

unsigned char Buffer[50];

char tested_by[50];
char auth_by[50];
char part_id[50];
unsigned int deg[30];
unsigned int volt[30];
String sts = "PASS";
String sw_case = "";

#define vb_1   0x60    //V_BAT
#define vb_2   0x50

#define vd_1  0x60    //V_DCDC
#define vd_2  0x60

#define vm_1  0x60   //VOUT_M
#define vm_2  0x70

#define va_1  0x60   //VOT_A
#define va_2  0x80

#define ss1_1  0x60  //SSR-1
#define ss1_2  0x90

#define ss2_1  0x61  //SSR-2
#define ss2_2  0x00

#define ss3_1  0x61  //SSR-3
#define ss3_2  0x10

#define ss4_1  0x61  //SSR-4
#define ss4_2  0x20

unsigned char   count[8] = {0x5A, 0xA5, 0x05, 0x82, 0x00 , 0x00, 0x00, 0x00};
unsigned char   page_set[10] = {0x5A, 0xA5, 0x07, 0x82, 0x00 , 0x84, 0x5A, 0x01, 0x00, 0x00};//5A A5 07 82 00 84 5A 01 00 0X X-page number 7inch DMG80480C070 15WTR model

int s1, s2, s3, s4;
uint32_t ts = 0;
uint32_t ts1 = 0;
int time_ok, sw_ch;
String ssr_case = "";
int a1, a2, a3, a4;
int vbat, vdcdc, volt_ch;
int vout_m, vout_a;
int delay_time;
int vo_m, vo_a;
int first_ch1, first_ch2;

void setup()
{

  Serial.begin(115200);
  Serial.println("Ready......");

  timer = timerBegin(0, 80, true);
  timerAttachInterrupt(timer, &onTimer, true);
  timerAlarmWrite(timer, 100000, true);
  timerAlarmEnable(timer);
  Serial.println("STARTED...");

  pinMode(R1, OUTPUT);
  pinMode(R2, OUTPUT);
  pinMode(R3, OUTPUT);
  pinMode(R4, OUTPUT);
  pinMode(R5, OUTPUT); //dcdc 12v
  pinMode(R6, OUTPUT); //vbat 12v
  pinMode(BUZZER, OUTPUT);

  digitalWrite(R1, LOW);
  digitalWrite(R2, LOW);
  digitalWrite(R3, LOW);
  digitalWrite(R4, LOW);
  digitalWrite(R5, LOW);
  digitalWrite(R6, LOW);

  pinMode(SR_1, INPUT);
  pinMode(SR_2, INPUT);
  pinMode(SR_3, INPUT);
  pinMode(SR_4, INPUT);


  hmi_Serial2.begin(115200, SERIAL_8N1, RXD2, TXD2);

  WiFi.begin(ssid, password);  //WiFi connection


  while (WiFi.status() != WL_CONNECTED)  //Wait for the WiFI connection completion
  {
    digitalWrite(BUZZER, HIGH);
    delay(500);
    Serial.println("Waiting for connection");
    digitalWrite(BUZZER, LOW);
    delay(500);
  }
  Serial.print("Connected with:"); Serial.println(ssid);

  page(2);

  xTaskCreate(Task1code, "Task 1", 2048, NULL, 1, NULL);

  data_send(vb_1, vb_2, 0);
  data_send(vd_1, vd_2, 0);
  data_send(vm_1, vm_2, 0);
  data_send(va_1, va_2, 0);
  data_send(ss1_1, ss1_2, 0);
  data_send(ss2_1, ss2_2, 0);
  data_send(ss3_1, ss3_2, 0);
  data_send(ss4_1, ss4_2, 0);

  ssec = sec = 0;
}


void Task1code( void *pvParameters)
{
  while (1)
  {
    /*
      volt_ch=1;
      digitalWrite(R6,HIGH);
      vout_m=measure(VOUT_M)/2.375;
      vout_a=measure(VOUT_A)/2.360;
      if(vout_m<200){vout_m=0;}
      if(vout_a<200){vout_a=0;}
      Serial.printf("VOUT_M: %d  , VOUT_A: %d\n",vout_m,vout_a);
      delay(500);
    */
    if (volt_ch == 1)
    {
      vout_m = measure(VOUT_M) / 2.375;
      vout_a = measure(VOUT_A) / 2.360;
      if (vout_m < 200) {
        vout_m = 0;
      }
      if (vout_a < 200) {
        vout_a = 0;
      }
      data_send(vb_1, vb_2, vbat);
      data_send(vd_1, vd_2, vdcdc);
      data_send(vm_1, vm_2, vout_m);
      data_send(va_1, va_2, vout_a);
      Serial.printf("VOUT_M: %d  , VOUT_A: %d , F_1: %d , F_2: %d\n", vout_m, vout_a, first_ch1, first_ch2);
    }
    vTaskDelay(1 / portTICK_PERIOD_MS);
  }
}

void loop()
{
  readSerialString();
  check_process();


  if (interruptCounter > 0 && en == 1)
  {
    portENTER_CRITICAL(&timerMux);
    interruptCounter = 0;
    portEXIT_CRITICAL(&timerMux);
    ssec++; if (ssec > 10) {
      ssec = 0;
      sec++;
    }
    if (sec > 30) {
      sec = 0;
    }
    // Serial.printf("SEC:%d\n",sec);
  }

  if (sw_ch == 1 && en == 1)
  {

    if (sec > 12)
    {
      digitalWrite(R1, LOW);
      digitalWrite(R2, LOW);
      digitalWrite(R3, LOW);
      digitalWrite(R4, LOW);
      digitalWrite(R5, LOW);
      digitalWrite(R6, LOW);

      if (s1 == 1 && s2 == 1 && s3 == 1) {
        Serial.println("SSR PASSED");
        ssr_case = "PASS";
      }
      else {
        Serial.println("SSR FAILED");
        ssr_case = "FAIL";
      }
      sw_ch = 0;
      volt_ch = 1; first_ch1 = 0; first_ch2 = 0;
      buzzer(3, 500);
      sec = 0; ssec = 0;
    }

    if (sec < 3) {
      digitalWrite(R1, HIGH);
      if (digitalRead(SR_1) == LOW) {
        s1 = 1;
      } else {
        s1 = 0;
      }
    }
    if (sec > 3) {
      digitalWrite(R2, HIGH);
      if (digitalRead(SR_2) == LOW) {
        s2 = 1;
      } else {
        s2 = 0;
      }
    }
    if (sec > 6) {
      digitalWrite(R3, HIGH);
      if (digitalRead(SR_3) == LOW) {
        s3 = 1;
      } else {
        s3 = 0;
      }
    }
    if (sec > 9) {
      digitalWrite(R4, HIGH);
      if (digitalRead(SR_4) == LOW) {
        s4 = 1;
      } else {
        s4 = 0;
      }
    }


    //   Serial.printf("S1: %d, S2: %d , S3: %d S4: %s\n" ,s1,s2,s3,s4);


    data_send(ss1_1, ss1_2, s1);
    data_send(ss2_1, ss2_2, s2);
    data_send(ss3_1, ss3_2, s3);
    data_send(ss4_1, ss4_2, s4);

  }

  if (volt_ch == 1 && en == 1)
  {

    if (sec > 20)
    {
      digitalWrite(R1, LOW);
      digitalWrite(R2, LOW);
      digitalWrite(R3, LOW);
      digitalWrite(R4, LOW);
      digitalWrite(R5, LOW);
      digitalWrite(R6, LOW);
      delay(500);
      sw_ch = 0; volt_ch = 0;
      buzzer(5, 500);
      if (ssr_case == "PASS" && first_ch1 == 1 && first_ch2 == 1) {
        Serial.println("PASSED");
        page(9);
        delay(1000);
        buzzer(5, 200);
        page(5);
      }
      else {
        Serial.println("Failed.......");
        page(10);
        delay(1000);
        buzzer(10, 100);
        page(5);
      }
      ssec = sec = 0; en = 0;
    }
    if (sec < 10)
    {
      digitalWrite(R5, HIGH); digitalWrite(R6, LOW);
      if (vout_m < 100 && vout_a > 1000) {
        first_ch1 = 1;
      }
      // else{first_ch1=0;}
    }
    if (sec > 10 && sec < 20)
    {
      digitalWrite(R5, LOW); digitalWrite(R6, HIGH);
      if (vout_m > 1000 && vout_a > 1000) {
        first_ch2 = 1;
      }
      //else{first_ch2=0;}

    }

  }

}

void readSerialString()
{
  serInIndx = 0;

  if (Serial.available())
  {
    delay(10);
    while (Serial.available())
    {
      sb = Serial.read();
      serInString[serInIndx] = sb;
      serInIndx++;
      Serial.write(sb);
    }
    // for(int i=0;i<11;i++){Serial.print(serInString[i],HEX);Serial.print(" ");}
    //  if(serInString[0]=='a'){count_Val=((serInString[1]-48)*100)+((serInString[2]-48)*10)+((serInString[3]-48)*1); Data_Arduino_to_Display(); }
    if (serInString[0] == 'b') {
      serInString[0] = NULL;
      page_num = serInString[1] - 48;
      page(page_num);
    }

  }

  Serial.flush();

  if (hmi_Serial2.available())
  {

    delay(20);
    while (hmi_Serial2.available())
    {
      sb = hmi_Serial2.read();
      Buffer[serInIndx] = sb;
      serInIndx++;

    }
    //  for(int i=0;i<11;i++){Serial.print(Buffer[i],HEX);Serial.print(" ");}
    //   Serial.println(" ");

  }

}
//-----------------------------------------------------------------------------------------------------------------check process-----------------------------------
void check_process()
{

  if (Buffer[0] == 0X5A) //0x5A
  {

    if (Buffer[4] == 0X81 &&  Buffer[5] == 0X00)
    {
      digitalWrite(R1, LOW);
      digitalWrite(R2, LOW);
      digitalWrite(R3, LOW);
      digitalWrite(R4, LOW);
      digitalWrite(R5, LOW);
      digitalWrite(R6, LOW);
      buzzer(1, 200); Serial.println("submit");
      page(8);
      send_data();
      clear_buffer();
      data_send(vb_1, vb_2, 0);
      data_send(vd_1, vd_2, 0);
      data_send(vm_1, vm_2, 0);
      data_send(va_1, va_2, 0);
      data_send(ss1_1, ss1_2, 0);
      data_send(ss2_1, ss2_2, 0);
      data_send(ss3_1, ss3_2, 0);
      data_send(ss4_1, ss4_2, 0);
    }
    if (Buffer[4] == 0X82 &&  Buffer[5] == 0X00)
    {
      digitalWrite(R1, LOW);
      digitalWrite(R2, LOW);
      digitalWrite(R3, LOW);
      digitalWrite(R4, LOW);
      digitalWrite(R5, LOW);
      digitalWrite(R6, LOW);
      buzzer(1, 200);
      Serial.println("cancel");
      page(4);
      clear_buffer();
      data_send(vb_1, vb_2, 0);
      data_send(vd_1, vd_2, 0);
      data_send(vm_1, vm_2, 0);
      data_send(va_1, va_2, 0);
      data_send(ss1_1, ss1_2, 0);
      data_send(ss2_1, ss2_2, 0);
      data_send(ss3_1, ss3_2, 0);
      data_send(ss4_1, ss4_2, 0);
    }

    if (Buffer[4] == 0X20 &&  Buffer[5] == 0XFF)
    {
      buzzer(1, 200);
      int char_count = Buffer[8];
      for (int i = 0; i < char_count; i++) {
        tested_by[i] = Buffer[9 + i];
      }
      Serial.println(tested_by); clear_buffer(); delay(1500); page(3);

    }
    if (Buffer[4] == 0X21 &&  Buffer[5] == 0XFF)
    {
      buzzer(1, 200);
      int char_count = Buffer[8];
      for (int i = 0; i < char_count; i++) {
        auth_by[i] = Buffer[9 + i];
      }
      Serial.println(auth_by); clear_buffer(); delay(1500); page(4);
    }
    if (Buffer[4] == 0X22 &&  Buffer[5] == 0XFF)
    {
      //for(int i=0;i<50;i++){part_id[i]=NULL;}
      buzzer(1, 200);
      int char_count = Buffer[8]; Serial.print("count:"); Serial.println(char_count);
      for (int i = 0; i < char_count; i++) {
        part_id[i] = Buffer[9 + i];
      }
      Serial.println(part_id); clear_buffer(); delay(1500);

      Serial.print("PART_ID:"); Serial.println(part_id);
      Serial.print("TESTED:"); Serial.println(tested_by);
      Serial.print("AUTH:"); Serial.println(auth_by);
      page(11);
      sw_ch = 1;
      en = 1;
      ssec = sec = 0;

    }
  }
}


//--------------------------------------------------------------------------------------------------------------------------------------------------
void buzzer(int cou, int dur)
{
  for (int i = 0; i < cou; i++)
  {
    digitalWrite(BUZZER, HIGH); delay(1 + dur); digitalWrite(BUZZER, LOW); delay(1 + dur);
  }
}

void data_send(char ad1, char ad2, int valc)
{
  // Serial.print("VAL:");Serial.println(valc);
  count[6] = highByte(valc);
  count[7] = lowByte(valc);
  count[4] = ad1;
  count[5] = ad2;
  // for(int i=0;i<8;i++){Serial.print(count[i],HEX);Serial.print(" ");}
  hmi_Serial2.write(count, 8);
}
void page(int page_num)
{
  page_set[8] = highByte(page_num);
  page_set[9] = lowByte(page_num);
  //  page_set[8] = page_num;
  //  for(int i=0;i<9;i++){Serial.print(page_set[i],HEX);Serial.print(" ");}
  hmi_Serial2.write(page_set, 10);
}

void clear_buffer()
{
  for (int i = 0; i < 9; i++) {
    Buffer[i] = 0x00;
  }
}
int measure(unsigned char channel)
{
  int temp = 0, temp1 = 0, adc = 0;
  unsigned int in, j;
  for (j = 0; j < 100; j++)
  {
    for (in = 0; in <= 100; in++)
    {
      temp = analogRead(channel);
      if (temp > adc) {
        adc = temp;
      }
    }
    temp1 = temp1 + adc;
    adc = temp = 0;
  }
  temp1 = temp1 / 100;
  return (temp1);
}
//-------------------------------------------------------------------------------------------------------------------------------------------------------
void send_data()
{

  // https://jig.konwertindiamotors.com/api/send?sno=1&testby=2&appby=3

  if ((WiFi.status() == WL_CONNECTED)) //Check WiFi connection status
  {
    Serial.print("UPDATING...");

    HTTPClient http;    //Declare object of class HTTPClient

    String  data1 = "sno=";
    String  data2 = "&testby=";
    String  data3 = "&appby=";

    http.begin(URL +
               data1 + part_id +
               data2 + tested_by +
               data3 + auth_by +
               keyParam()
              );
    Serial.println(
      URL +
      data1 + part_id +
      data2 + tested_by +
      data3 + auth_by +
      keyParam()
    );



    int httpCode = http.GET();
    Serial.println(httpCode);
    String payload = http.getString();
    Serial.println(payload);
    if (httpCode > 0) {
      Serial.print("DONE.. data send successfully");
      send_data1();
    }
    else {
      Serial.println("Error in HTTP request");
      buzzer(10, 100);
      page(7);
      delay(3000);
      page(4);
    }

    http.end();  //Close connection

  }
  else
  {

    Serial.println("Error in WiFi connection");
  }


}

void send_data1()
{

  // https://jig.konwertindiamotors.com/api/send_ssr?sno=1&delay=2&voutm=3&vout_a=4&ssr_1=3&ssr_2=3&ssr_3=3&ssr_4=3


  if ((WiFi.status() == WL_CONNECTED)) //Check WiFi connection status
  {
    Serial.print("UPDATING...");

    HTTPClient http;    //Declare object of class HTTPClient

    String  data1 = "sno=";
    String  data2 = "&delay=";
    String  data3 = "&voutm=";
    String  data4 = "&vout_a=";
    String  data5 = "&ssr_1=";
    String  data6 = "&ssr_2=";
    String  data7 = "&ssr_3=";
    String  data8 = "&ssr_4=";


    http.begin(URL1 +
               data1 + part_id +
               data2 + delay_time +
               data3 + vout_m +
               data4 + vout_a +
               data5 + s1 +
               data6 + s2 +
               data7 + s3 +
               data8 + s4 +
               keyParam()
              );
    Serial.println(
      URL1 +
      data1 + part_id +
      data2 + delay_time +
      data3 + vout_m +
      data4 + vout_a +
      data5 + s1 +
      data6 + s2 +
      data7 + s3 +
      data8 + s4 +
      keyParam()
    );

    int httpCode = http.GET();
    Serial.println(httpCode);
    String payload = http.getString();
    Serial.println(payload);
    if (httpCode > 0) {
      Serial.print("DONE.. data send successfully");
      page(6);
      buzzer(5, 500);
      page(4);
    }
    else {
      Serial.println("Error in HTTP request");
      page(7);
      buzzer(10, 100);
      delay(3000);
      page(4);
    }

    http.end();  //Close connection

  }
  else
  {

    Serial.println("Error in WiFi connection");
  }


}
