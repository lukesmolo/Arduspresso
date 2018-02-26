#include "utils.h"
uint8_t mode;
uint8_t id;

char**
str_split(char* a_str, const char a_delim) {
	char** result    = 0;
	size_t count     = 0;
	char* tmp        = a_str;
	char* last_comma = 0;
	char delim[2];
	delim[0] = a_delim;
	delim[1] = 0;

	/* Count how many elements will be extracted. */
	while (*tmp) {
		if (a_delim == *tmp) {
			count++;
			last_comma = tmp;
		}
		tmp++;
	}

	/* Add space for trailing token. */
	count += last_comma < (a_str + strlen(a_str) - 1);

	/* Add space for terminating null string so caller
	   knows where the list of returned strings ends. */
	count++;

	result = (char**)malloc(sizeof(char*) * count);

	if (result) {
		size_t idx  = 0;
		char* token = strtok(a_str, delim);

		while (token) {
			assert(idx < count);
			*(result + idx++) = strdup(token);
			token = strtok(0, delim);
		}
		assert(idx == count - 1);
		*(result + idx) = 0;
	}

	return result;
}

int
str_to_int(char *str) {
	return strtol(str, (char **)NULL, 10);
}

int
get_params( char *t, char *p) {
	int type = str_to_int(t);
	int payload = str_to_int(p);
	switch(type) {
		case SCAN_MODE:
			mode = SCAN_MODE;
			break;
		case ENROLL_MODE:
			mode = ENROLL_MODE;
			id = payload;
			break;
		default:
			break;
	}

	return 0;
}
