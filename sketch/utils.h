#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <assert.h>
#include <stdint.h>
#include <inttypes.h>

enum msg {
	SCAN_MODE,
	ENROLL_MODE,
	FOUND_FINGERPRINT
};

extern uint8_t mode;
extern uint8_t id;
char** str_split(char* a_str, const char a_delim);
int get_params(char *t, char *p);
int str_to_int(char *str);
