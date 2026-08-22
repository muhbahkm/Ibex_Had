# Product

## Definition

IBEX HAD is a shared customer ledger between a business and its customers. The business records or imports financial movements; each customer can independently view their balance, transaction history, documents, and statement without requesting a manual PDF or WhatsApp message.

## Core job to be done

When a person or organization has a financial relationship with a business, they should be able to know at any time what they owe, what is owed to them, and which movements produced that balance.

## MVP principles

- Narrow product scope before expansion.
- Multi-currency from day one.
- Deterministic ledger as the financial source of truth.
- Posted financial transactions are not silently edited or deleted.
- Corrections use reversal/adjustment flows with auditability.
- A customer sees only their own financial relationship.
- Arabic-first, RTL, mobile-first experience with Latin digits 0-9.
- The mobile app is distributed through official app stores.
- Merchant web exists for heavier operational workflows.

## Initial transaction concepts

- Opening balance
- Sale / invoice on account
- Receipt / customer payment
- Disbursement when applicable
- Return
- Discount / adjustment
- Reversal

The UI expresses business events. The domain layer determines their debit/credit effect.

## Identity model

User authentication is separate from customer financial identity. A business may create a customer before that customer registers. A customer identity can later be claimed/linked to a registered user through a controlled flow.

## Future channels

IBEX HAD is designed so the same use cases can later be exposed through ChatGPT using MCP/OpenAI Apps SDK without duplicating financial logic.
