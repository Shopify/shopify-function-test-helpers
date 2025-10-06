use crate::schema::CartLineTarget;
use crate::schema::CartLinesDiscountsGenerateRunResult;
use crate::schema::CartOperation;
use crate::schema::DiscountClass;
use crate::schema::OrderDiscountCandidate;
use crate::schema::OrderDiscountCandidateTarget;
use crate::schema::OrderDiscountCandidateValue;
use crate::schema::OrderDiscountSelectionStrategy;
use crate::schema::OrderDiscountsAddOperation;
use crate::schema::OrderSubtotalTarget;
use crate::schema::Percentage;
use crate::schema::ProductDiscountCandidate;
use crate::schema::ProductDiscountCandidateTarget;
use crate::schema::ProductDiscountCandidateValue;
use crate::schema::ProductDiscountSelectionStrategy;
use crate::schema::ProductDiscountsAddOperation;

use super::schema;
use shopify_function::prelude::*;
use shopify_function::Result;

#[shopify_function]
fn cart_lines_discounts_generate_run(
    input: schema::cart_lines_discounts_generate_run::Input,
) -> Result<CartLinesDiscountsGenerateRunResult> {
    let max_cart_line = input
        .cart()
        .lines()
        .iter()
        .max_by(|a, b| {
            a.cost()
                .subtotal_amount()
                .amount()
                .partial_cmp(b.cost().subtotal_amount().amount())
                .unwrap_or(std::cmp::Ordering::Equal)
        })
        .ok_or("No cart lines found")?;

    let has_order_discount_class = input
        .discount()
        .discount_classes()
        .contains(&DiscountClass::Order);
    let has_product_discount_class = input
        .discount()
        .discount_classes()
        .contains(&DiscountClass::Product);

    if !has_order_discount_class && !has_product_discount_class {
        return Ok(CartLinesDiscountsGenerateRunResult { operations: vec![] });
    }

    let mut operations = vec![];

    // Read the metafield to get the discount percentage
    // Default to 10.0 if metafield is not present
    let discount_percentage = input
        .discount()
        .metafield()
        .and_then(|m| m.value().parse::<f64>().ok())
        .unwrap_or(10.0);

    // Check if the discount has the ORDER class
    if has_order_discount_class {
        operations.push(CartOperation::OrderDiscountsAdd(
            OrderDiscountsAddOperation {
                selection_strategy: OrderDiscountSelectionStrategy::First,
                candidates: vec![OrderDiscountCandidate {
                    targets: vec![OrderDiscountCandidateTarget::OrderSubtotal(
                        OrderSubtotalTarget {
                            excluded_cart_line_ids: vec![],
                        },
                    )],
                    message: Some(format!("{}% OFF ORDER", discount_percentage)),
                    value: OrderDiscountCandidateValue::Percentage(Percentage {
                        value: Decimal(discount_percentage),
                    }),
                    conditions: None,
                    associated_discount_code: None,
                }],
            },
        ));
    }

    // Check if the discount has the PRODUCT class
    if has_product_discount_class {
        operations.push(CartOperation::ProductDiscountsAdd(
            ProductDiscountsAddOperation {
                selection_strategy: ProductDiscountSelectionStrategy::First,
                candidates: vec![ProductDiscountCandidate {
                    targets: vec![ProductDiscountCandidateTarget::CartLine(CartLineTarget {
                        id: max_cart_line.id().clone(),
                        quantity: None,
                    })],
                    message: Some(format!("{}% OFF PRODUCT", discount_percentage * 2.0)),
                    value: ProductDiscountCandidateValue::Percentage(Percentage {
                        value: Decimal(discount_percentage * 2.0),
                    }),
                    associated_discount_code: None,
                }],
            },
        ));
    }

    Ok(CartLinesDiscountsGenerateRunResult { operations })
}
