BugBoard attachment store
--------------------------
This directory holds files attached to bug reports. The /attachment endpoint
serves files from here by name — which is exactly why it is vulnerable to path
traversal (see VULN.md).
