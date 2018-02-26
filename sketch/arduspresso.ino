#include <Adafruit_Fingerprint.h>

// On Leonardo/Micro or others with hardware serial, use those! #0 is green wire, #1 is white
// uncomment this line:
// #define mySerial Serial1

// For UNO and others without hardware serial, we must use software serial...
// pin #2 is IN from sensor (GREEN wire)
// pin #3 is OUT from arduino  (WHITE wire)
// comment these two lines if using hardware serial
#include <SoftwareSerial.h>
#include "utils.h"

#define TELEGRAM_PRINT 1
SoftwareSerial mySerial(2, 3);

Adafruit_Fingerprint finger = Adafruit_Fingerprint(&mySerial);
int number_pin = 9;


void
telegram_print(char *string) {
#if TELEGRAM_PRINT
	Serial.println((String)"\\"+(String)string);
#else
	Serial.println(string);
#endif
}

void
setup() {
	mode = SCAN_MODE;
	Serial.begin(9600);
	while (!Serial);  // For Yun/Leo/Micro/Zero/...
	delay(100);
	// set the data rate for the sensor serial port
	finger.begin(57600);
  pinMode(number_pin, OUTPUT);

	if (finger.verifyPassword()) {
		//Serial.println("Found fingerprint sensor!");
	} else {
		Serial.println("Did not find fingerprint sensor :(");
		while (1) { delay(1); }
	}
}

uint8_t
readnumber(void) {
	uint8_t num = 0;

	while (num == 0) {
		while (! Serial.available());
		num = Serial.parseInt();
	}
	return num;
}

uint8_t
getFingerprintEnroll() {

	int p = -1;
	//telegram_print("Waiting for valid finger to enroll");
	while (p != FINGERPRINT_OK  && !Serial.available()) {
		p = finger.getImage();
		switch (p) {
			case FINGERPRINT_OK:
				//telegram_print("Image taken");
				break;
			case FINGERPRINT_NOFINGER:
				//Serial.println(".");
				break;
			case FINGERPRINT_PACKETRECIEVEERR:
				telegram_print("Communication error");
				break;
			case FINGERPRINT_IMAGEFAIL:
				telegram_print("Imaging error");
				break;
			default:
				telegram_print("Unknown error");
				break;
		}
	}
	if(Serial.available()) {
		return;
	}

	// OK success!

	p = finger.image2Tz(1);
	switch (p) {
		case FINGERPRINT_OK:
			//telegram_print("Image converted");
			break;
		case FINGERPRINT_IMAGEMESS:
			telegram_print("Image too messy");
			return p;
		case FINGERPRINT_PACKETRECIEVEERR:
			telegram_print("Communication error");
			return p;
		case FINGERPRINT_FEATUREFAIL:
			telegram_print("Could not find fingerprint features");
			return p;
		case FINGERPRINT_INVALIDIMAGE:
			telegram_print("Could not find fingerprint features");
			return p;
		default:
			telegram_print("Unknown error");
			return p;
	}

	/*telegram_print("Remove finger");
	delay(1000);
	p = 0;
	while (p != FINGERPRINT_NOFINGER) {
		p = finger.getImage();
	}
	Serial.print("ID "); Serial.println(id);
	telegram_print("Place same finger again");*/
	p = -1;
	while (p != FINGERPRINT_OK  && !Serial.available()) {
		p = finger.getImage();
		switch (p) {
			case FINGERPRINT_OK:
				//telegram_print("Image taken");
				break;
			case FINGERPRINT_NOFINGER:
				//Serial.print(".");
				break;
			case FINGERPRINT_PACKETRECIEVEERR:
				telegram_print("Communication error");
				break;
			case FINGERPRINT_IMAGEFAIL:
				telegram_print("Imaging error");
				break;
			default:
				telegram_print("Unknown error");
				break;
		}
	}

	if(Serial.available()) {
		return;
	}
	// OK success!

	p = finger.image2Tz(2);
	switch (p) {
		case FINGERPRINT_OK:
			//telegram_print("Image converted");
			break;
		case FINGERPRINT_IMAGEMESS:
			telegram_print("Image too messy");
			return p;
		case FINGERPRINT_PACKETRECIEVEERR:
			telegram_print("Communication error");
			return p;
		case FINGERPRINT_FEATUREFAIL:
			telegram_print("Could not find fingerprint features");
			return p;
		case FINGERPRINT_INVALIDIMAGE:
			telegram_print("Could not find fingerprint features");
			return p;
		default:
			telegram_print("Unknown error");
			return p;
	}

	// OK converted!
	//Serial.print("Creating model for #");  Serial.println(id);

	p = finger.createModel();
	if (p == FINGERPRINT_OK) {
		//telegram_print("Prints matched!");
	} else if (p == FINGERPRINT_PACKETRECIEVEERR) {
		telegram_print("Communication error");
		return p;
	} else if (p == FINGERPRINT_ENROLLMISMATCH) {
		telegram_print("Fingerprints did not match");
		return p;
	} else {
		telegram_print("Unknown error");
		return p;
	}

	//Serial.print("ID "); Serial.println(id);
	p = finger.storeModel(id);
	if (p == FINGERPRINT_OK) {
		//telegram_print("Fingerprint stored!");
	} else if (p == FINGERPRINT_PACKETRECIEVEERR) {
		telegram_print("Communication error");
		return p;
	} else if (p == FINGERPRINT_BADLOCATION) {
		telegram_print("Could not store in that location");
		return p;
	} else if (p == FINGERPRINT_FLASHERR) {
		telegram_print("Error writing to flash");
		return p;
	} else {
		telegram_print("Unknown error");
		return p;
	}
	delay(300);
	Serial.print("done");
	delay(2000);
}

// returns -1 if failed, otherwise returns ID #
int
getFingerprintIDez() {
	uint8_t p = finger.getImage();
	if (p != FINGERPRINT_OK)  return -1;

	p = finger.image2Tz();
	if (p != FINGERPRINT_OK)  return -1;

	p = finger.fingerFastSearch();
	if (p != FINGERPRINT_OK)  return -1;

	// found a match!
	String tmp_string = (String)FOUND_FINGERPRINT + ","+(String)finger.fingerID;
	Serial.println(tmp_string);
    digitalWrite(number_pin, HIGH);
    delay(1000);
    digitalWrite(number_pin, LOW); 
#if TELEGRAM_PRINT == 0
	Serial.print("Found ID #"); Serial.print(finger.fingerID);
	Serial.print(" with confidence of "); Serial.println(finger.confidence);
#endif
	return finger.fingerID;
}


void
loop() {                     // run over and over again
	String serial_string;
	uint8_t buf_len = 50;
	char buf[buf_len];
	char** tokens;

	if (Serial.available()) { //read serial
		serial_string = Serial.readString();
		memset(buf, 0, buf_len);
		serial_string.toCharArray(buf, buf_len);
		tokens = str_split(buf, ',');
		if(tokens) { //messages should be composed of only two parts
			get_params(*(tokens), *(tokens + 1));
			free(*(tokens));
			free(*(tokens + 1));
			printf("\n");
			free(tokens);
		}
	}
	if(mode == SCAN_MODE) {
		getFingerprintIDez();
		delay(2000);
	} else if(mode == ENROLL_MODE) {
		//don't ned to run this at full speed.
		//telegram_print("Ready to enroll a fingerprint!");
		//telegram_print("Enrolling new fingerprint");
		Serial.print("ok");
		delay(500);
		while (!getFingerprintEnroll() && !Serial.available());
		if(Serial.available()) {
			serial_string = Serial.readString();
			Serial.print(serial_string);
		}
		mode = SCAN_MODE;
	}

}


