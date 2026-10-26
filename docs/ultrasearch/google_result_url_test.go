package main

import (
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
)

type padicheckTestTransport func(*http.Request) (*http.Response, error)

func (f padicheckTestTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestGoogleResultURLs(t *testing.T) {
	for _, tc := range []struct {
		raw, location, want string
		status              int
		requests            int
	}{
		{"https://www.postgresql.org/docs/", "", "https://www.postgresql.org/docs/", 0, 0},
		{"/goto?url=opaque", "https://www.postgresql.org/docs/", "https://www.postgresql.org/docs/", 302, 1},
		{"https://www.google.com/goto?url=opaque", "https://www.postgresql.org/", "https://www.postgresql.org/", 302, 1},
		{"/url?q=https%3A%2F%2Fwww.postgresql.org%2F", "", "https://www.postgresql.org/", 0, 0},
		{"/goto?url=opaque", "", "", 200, 1},
		{"/goto?url=opaque", "http://user:pass@example.com/", "", 302, 1},
		{"/goto?url=opaque", "javascript:alert(1)", "", 302, 1},
		{"/goto?url=opaque", "/sorry/", "", 302, 1},
		{"/search?q=foo", "", "", 0, 0},
		{"javascript:alert(1)", "", "", 0, 0},
		{"//127.0.0.1/goto?url=opaque", "", "", 0, 0},
		{"https://user:pass@example.com/", "", "", 0, 0},
	} {
		t.Run(tc.raw+tc.location, func(t *testing.T) {
			requests := 0
			client := *padicheckGoogleRedirectClient
			client.Transport = padicheckTestTransport(func(r *http.Request) (*http.Response, error) {
				requests++
				if r.URL.Host != "www.google.com" || r.URL.Scheme != "https" {
					t.Fatal("Unexpected fetch target")
				}
				return &http.Response{StatusCode: tc.status, Header: http.Header{"Location": []string{tc.location}}, Body: io.NopCloser(strings.NewReader("")), Request: r}, nil
			})
			got, ok := padicheckResolveGoogleResultURL(tc.raw, &client)
			if got != tc.want || ok != (tc.want != "") || requests != tc.requests {
				t.Fatalf("got %q %v requests=%d; want %q requests=%d", got, ok, requests, tc.want, tc.requests)
			}
		})
	}
}

func TestGoogleRedirectNetworkFailure(t *testing.T) {
	client := *padicheckGoogleRedirectClient
	client.Transport = padicheckTestTransport(func(*http.Request) (*http.Response, error) { return nil, errors.New("network failure") })
	if _, ok := padicheckResolveGoogleResultURL("/goto?url=opaque", &client); ok {
		t.Fatal("Network failures must not return source URLs")
	}
}
