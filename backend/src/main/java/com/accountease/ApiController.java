package com.accountease;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*", allowCredentials = "false")
public class ApiController {
  private final List<Map<String, Object>> organizations = List.of(
      Map.of("id", 1, "name", "Sukoon General Store", "address", "12 Market Road, Jaipur"),
      Map.of("id", 2, "name", "Narmada Kirana", "address", "Near Bus Stand, Kota"));

  @PostMapping("/auth/login")
  public Map<String, String> login(@RequestBody LoginRequest request) {
    if (!"rajesh".equals(request.username()) || !"demo123".equals(request.password())) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username or password");
    }
    return Map.of("token", UUID.randomUUID().toString(), "username", "rajesh", "name", "Rajesh");
  }

  @GetMapping("/organizations")
  public List<Map<String, Object>> organizations() { return organizations; }

  @PostMapping("/organizations")
  @ResponseStatus(HttpStatus.CREATED)
  public Map<String, Object> createOrganization(@RequestBody OrganizationRequest request) {
    return Map.of("id", UUID.randomUUID().toString(), "name", request.name(), "address", request.address() == null ? "" : request.address());
  }

  @GetMapping("/organizations/{organizationId}/customers")
  public List<Map<String, Object>> customers(@PathVariable Long organizationId, @RequestParam(defaultValue = "") String search) {
    return List.of();
  }

  @PostMapping("/organizations/{organizationId}/customers")
  @ResponseStatus(HttpStatus.CREATED)
  public Map<String, Object> createCustomer(@PathVariable Long organizationId, @RequestBody CustomerRequest request) {
    return Map.of("id", UUID.randomUUID().toString(), "organizationId", organizationId, "name", request.name(), "mobileNumber", request.mobileNumber());
  }

  @GetMapping("/customers/{customerId}/transactions")
  public List<Map<String, Object>> transactions(@PathVariable Long customerId, @RequestParam(required = false) String from, @RequestParam(required = false) String to) {
    return List.of();
  }

  @PostMapping("/customers/{customerId}/transactions")
  @ResponseStatus(HttpStatus.CREATED)
  public TransactionRequest createTransaction(@PathVariable Long customerId, @RequestBody TransactionRequest request) { return request; }

  public record LoginRequest(String username, String password) {}
  public record OrganizationRequest(String name, String address) {}
  public record CustomerRequest(String name, String mobileNumber, String fatherName, String address) {}
  public record TransactionRequest(String date, String item, String quantity, String rate, String amount, String balance) {}
}