package main

import (
	"net/http"
	"net/url"
	"strings"
	"time"
)

var padicheckGoogleRedirectClient = &http.Client{
	Timeout:       3 * time.Second,
	CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse },
}

func padicheckGoogleResultURL(raw string) (string, bool) {
	return padicheckResolveGoogleResultURL(raw, padicheckGoogleRedirectClient)
}

func padicheckResolveGoogleResultURL(raw string, client *http.Client) (string, bool) {
	validSource := func(u *url.URL) bool {
		host := strings.ToLower(u.Hostname())
		return (u.Scheme == "https" || u.Scheme == "http") && host != "" &&
			u.User == nil && host != "google.com" && host != "www.google.com"
	}

	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return "", false
	}
	if validSource(u) {
		return u.String(), true
	}
	if u.User != nil || u.Opaque != "" || (u.Scheme != "" && u.Scheme != "https") ||
		(u.Host != "" && u.Host != "www.google.com" && u.Host != "google.com") {
		return "", false
	}
	if u.Path != "/goto" && u.Path != "/url" {
		return "", false
	}
	if u.Path == "/url" {
		for _, key := range []string{"q", "url"} {
			if target, e := url.Parse(u.Query().Get(key)); e == nil && validSource(target) {
				return target.String(), true
			}
		}
	}
	// Only request Google's redirect endpoint. Never follow it to the source site.
	u.Scheme, u.Host = "https", "www.google.com"
	resp, err := client.Get(u.String())
	if err != nil {
		return "", false
	}
	defer resp.Body.Close()
	if resp.StatusCode < 300 || resp.StatusCode >= 400 {
		return "", false
	}
	target, err := resp.Location()
	if err != nil || !validSource(target) {
		return "", false
	}
	return target.String(), true
}
