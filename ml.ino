#include <Wire.h>
#include <ArduinoBLE.h>
#include <ArduinoJson.h>
#include <SparkFun_TMP117.h>
#include <Adafruit_SHT31.h>
#include <MAX30105.h>
#include "heartRate.h"
#include <TensorFlowLite.h>
#include "tensorflow/lite/micro/all_ops_resolver.h"
#include "tensorflow/lite/micro/micro_interpreter.h"
#include "tensorflow/lite/schema/schema_generated.h"
#include "tensorflow/lite/version.h"
#include "model.h"

#define BUZZER_PIN 6

const char* HR_SERVICE_UUID = "180D";
const char* HR_CHAR_UUID    = "2A37";
const char* USER_SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const char* USER_WRITE_UUID   = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

TMP117 tmp117;
Adafruit_SHT31 sht31 = Adafruit_SHT31();
MAX30105 ppg;

int userAge = 25;
int userFitness = 3; 

const int kTensorArenaSize = 4096;
uint8_t tensor_arena[kTensorArenaSize];
const tflite::Model* model = nullptr;
tflite::MicroInterpreter* interpreter = nullptr;
TfLiteTensor* input = nullptr;
TfLiteTensor* output = nullptr;
tflite::AllOpsResolver resolver;

void setup() {
  Serial.begin(115200);
  pinMode(BUZZER_PIN, OUTPUT);
  Wire.begin();

  if (!tmp117.begin()) while(1);
  if (!sht31.begin(0x44)) while(1);
  if (!ppg.begin(Wire, I2C_SPEED_FAST)) while(1); 
  else ppg.setup(0x1F, 4, 2, 100, 411, 16384); 

  model = tflite::GetModel(g_model);
  
  if (model->version() != TFLITE_SCHEMA_VERSION) {
    while(1);
  }
  
  static tflite::MicroInterpreter static_interpreter(
      model, resolver, tensor_arena, kTensorArenaSize, nullptr);
  interpreter = &static_interpreter;

  if (interpreter->AllocateTensors() != kTfLiteOk) {
    while(1);
  }

  input = interpreter->input(0);
  output = interpreter->output(0);

  if (!BLE.begin()) while(1);
  
  BLE.setLocalName("HotWatch ML");
  
  BLEService hrService(HR_SERVICE_UUID);
  BLECharacteristic hrChar(HR_CHAR_UUID, BLENotify, 2);
  hrService.addCharacteristic(hrChar);
  BLE.addService(hrService);

  BLEService userService(USER_SERVICE_UUID);
  BLECharacteristic userChar(USER_WRITE_UUID, BLEWrite, 512);
  userChar.setEventHandler(BLEWritten, onUserDataReceived);
  userService.addCharacteristic(userChar);
  BLE.addService(userService);

  BLE.advertise();
}

void loop() {
  BLE.poll();
  static uint32_t lastRun = 0;
  
  if (millis() - lastRun > 1000) { 
    
    float ambT = sht31.readTemperature();
    float hum = sht31.readHumidity();
    float skinT = tmp117.readTempC();
    long irVal = ppg.getIR();
    
    float bpm = 60.0; 
    if (checkForBeat(irVal)) {
      long delta = millis() - lastRun;
      bpm = 60000 / delta;
      if(bpm > 200 || bpm < 40) bpm = 75;
    }
    
    float heatIndex = ambT + (0.05 * hum); 
    float coreTemp = skinT + 0.77 * (skinT - ambT);

    if (input != nullptr) {
       input->data.f[0] = ambT;
       input->data.f[1] = hum;
       input->data.f[2] = skinT;
       input->data.f[3] = bpm;
       input->data.f[4] = coreTemp;
       input->data.f[5] = heatIndex;
       input->data.f[6] = (float)userAge;
       input->data.f[7] = (float)userFitness;
    }

    TfLiteStatus invoke_status = interpreter->Invoke();
    if (invoke_status != kTfLiteOk) {
      return;
    }

    float riskScore = output->data.f[0];
    
    if (riskScore < 0.4) {
      noTone(BUZZER_PIN);
    } else if (riskScore >= 0.4 && riskScore <= 0.8) {
      tone(BUZZER_PIN, 1000, 200);
    } else {
      tone(BUZZER_PIN, 2000, 1000);
    }

    lastRun = millis();
  }
}

void onUserDataReceived(BLEDevice central, BLECharacteristic characteristic) {
  const uint8_t* buffer = characteristic.value();
  int len = characteristic.valueLength();
  String json = "";
  for(int i=0; i<len; i++) json += (char)buffer[i];
  
  StaticJsonDocument<200> doc;
  deserializeJson(doc, json);
  
  if (doc.containsKey("a")) userAge = doc["a"];
  if (doc.containsKey("f")) userFitness = doc["f"];
}
